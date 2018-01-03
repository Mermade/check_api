var url = require('url');
var util = require('util');

var fetch = require('node-fetch');
var co = require('co');
var yaml = require('js-yaml');
var bsc = require('swagger-parser');
var openapi3 = require('swagger2openapi/validate.js');
var asyncApiSchema = require('asyncapi/schema/asyncapi.json');
var ajv = require('ajv')({
    allErrors: true,
    verbose: true,
    jsonPointers: true
});

//require("raml-1-parser/plugins/resourceUriValidationPlugin");
//require("raml-1-parser/plugins/crudAnnotationsValidator");
//require("raml-1-parser/plugins/uninheritedTypesDetector");
//require("raml-1-parser/plugins/xmlAnnotationsValidator");

function check_api(api,options,callback) {
options.mode = 'text';
options.format = 'none';

if (typeof api === 'object') {
    options.mode = 'json';
}
else if (typeof api === 'string') {
    api = api.split('\r').join('');
}

if (options.mode == 'text') {
    try {
        api = JSON.parse(api);
        options.mode = 'json';
    }
    catch (ex) {
        console.error(ex.message);
    }
}
if (options.mode == 'text') {
    try {
        if (api && api.startsWith('#%RAML')) options.format = 'raml';
        api = yaml.safeLoad(api);
        options.mode = 'yaml';
    }
    catch (ex) {
        console.error(ex.message);
    }
}

///

if ((options.mode == 'text') && (typeof api === 'string') && (api.startsWith('#') || (api.startsWith('FORMAT: '))) && (options.format !== 'raml')) {
    options.format = 'api_blueprint';
}
else {
    if (api && api.swaggerVersion && (typeof api.swaggerVersion === 'string') && api.swaggerVersion.startsWith('1.')) {
        options.format = 'swagger_1';
    }
    if (api && api.swagger && api.swagger === '2.0') {
        options.format = 'swagger_2';
    }
    if (api && api.openapi && api.openapi.startsWith('3.0')) {
        options.format = 'openapi_3';
    }
    if (api && api.asyncapi &&  api.asyncapi.startsWith('1.0')) {
        options.format = 'asyncapi_1';
    }
}

if (options.format === 'openapi_3') {
    var options = {laxRefs:true,resolve:true,source:options.source,convert:options.convert};
    try {
        openapi3.validate(api, options, function(err,options) {
            options.converted = options.openapi||api;
            if (err) callback(err, options)
            else {
	    	options.message = 'Valid openapi 3.0.x';
		options.context = [api.info.version + ' ' +
		    (api.servers && api.servers.length ? api.servers[0].url : 'Relative')];
                callback(null, options);
            }
        });
    }
    catch (ex) {
	var context = options.context.pop();
	options.context = [context];
        callback(ex, options);
    }
}
else if (options.format === 'asyncapi_1') {
    var validate = ajv.compile(asyncApiSchema);
    validate(api);
    var errors = validate.errors;
    if (errors) {
        callback(errors, options);
    }
    else {
        options.message = 'Valid AsyncAPI 1.0.x';
        callback(null, options);
    }
}
else if (options.format === 'api_blueprint') {
  var drafter = require('drafter.js')
  var res = drafter.parse(api, {generateSourceMap: true}, function (err, res) {
      if (err) {
         callback(err, options);
      }
      else {
          if (options.convert) {
	      var apib2swagger = require('apib2swagger');
	      apib2swagger.convert(api, function (err, res) {
	          options.converted = res.swagger;
	          callback(err, options);
	      });
          }
	  else {
	      options.message = 'Valid API Blueprint';
      	      callback(null, options);
	  }
      }
  });
}
else if (options.format === 'swagger_2') {
  var orig = api;
  bsc.validate(api,{dereference:{circular:'ignore'}},function(err,api){
    if (api && (!api.info || !api.info.title)) {
        err = {error:'No title'};
    }
    if (err) {
    	options.message = 'Invalid swagger 2.0';
    }
    else {
        options.message = 'Valid swagger 2.0';
	options.context = [api.info.title+' '+api.info.version+
	    ' host:'+(api.host ? api.host : 'relative')];
        if (api.info["x-logo"] && api.info["x-logo"].url) {
            options.context[0] += '\nHas logo: '+api.info["x-logo"].url;
        }
    }
    options.api = api||orig;
    callback(err, options);
  });
}
else if (options.format === 'swagger_1') {
    var base = options.source.split('/');
    var filename = base.pop();
    var extension = '';
    if (filename.endsWith('.json')) {
        extension = '.json';
    }
    else if (filename.endsWith('yaml')) {
        extension = '.yaml';
    }
    else {
        base.push(filename);
    }
    base = base.join('/');

    //if (options.source.endsWith('.json') || options.source.endsWith('.yaml')) {
    //    extension = '';
    //}

    var retrieve = [];
    var apiDeclarations = [];
    if (api.apis) {
        for (var component of api.apis) {
            component.path = component.path.replace('.{format}','.json');
            var lbase = base;
            if ((base.endsWith('/')) && (component.path.startsWith('/'))) {
                lbase = base.substr(0,base.length-1);
            }
            if (component.path.indexOf('://')>=0) {
                lbase = '';
            }
	    if (component.path.indexOf('.json')>=0) {
		extension = '';
	    }

            var u = (lbase+component.path+extension);
            console.log(u);
            retrieve.push(fetch(u,options.fetchOptions)
            .then(res => {
                console.log(res.status);
                return res.text();
            })
            .then(data => {
                //console.log(data);
                apiDeclarations.push(yaml.safeLoad(data,{json:true}));
            })
            .catch(err => {
                console.error(util.inspect(err));
            }));
        }
    }

    var s1p = require('swagger-tools');
    co(function* () {
      // resolve multiple promises in parallel
      var res = yield retrieve;
      var sVersion = 'v1_2';
      s1p.specs[sVersion].validate(api,apiDeclarations,function(err,result){
          console.log(JSON.stringify(result,null,2));
      });
      if (options.convert) {
          s1p.specs[sVersion].convert(api,apiDeclarations,true,function(err,converted){
	    options.converted = converted;
            callback(err, options);
        });
      }
      else {
      	options.api = api;
      	callback(null, options);
      }
    });

    // https://github.com/apigee-127/swagger-tools/blob/master/docs/API.md#validaterlorso-apideclarations-callback

}
else if (options.format == 'raml') {
    var raml = require('raml-1-parser');
    var node = raml.loadApiSync(options.source);
    var res = node.toJSON({"rootNodeDetails":true});
    if (res.errors && res.errors.length) callback(res.errors,options)
    else {
        options.api = res;
        options.message = api.title + ' ' +api.version;
        callback(null, options);
    }
    //console.log(JSON.stringify(node.toJSON({"rootNodeDetails":true}),null,2));
}
else {
    var err = {};
    err.message = 'No format/type detected';
    callback(err,options);
}

}

module.exports = {
    check_api : check_api
};
