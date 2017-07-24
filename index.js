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

function check_api(api,source,convert,callback) {
var mode = 'text';
var format = 'none';

api = api.split('\r').join('');

if (typeof api === 'object') {
	mode = 'json';
}

if (mode == 'text') {
try {
	api = JSON.parse(api);
	mode = 'json';
}
catch (ex) {
	//console.log(ex.message);
}
}
if (mode == 'text') {
	try {
	    if (api.startsWith('#%RAML')) format = 'raml';
		api = yaml.safeLoad(api);
		mode = 'yaml';
	}
	catch (ex) {
		//console.log(ex.message);
	}
}

///

if ((mode == 'text') && (api.startsWith('#') || (api.startsWith('FORMAT: '))) && (format !== 'raml')) {
	format = 'api_blueprint';
}
else {
	if (api.swaggerVersion && (typeof api.swaggerVersion === 'string') && api.swaggerVersion.startsWith('1.')) {
		format = 'swagger_1';
	}
	if (api.swagger && api.swagger == '2.0') {
		format = 'swagger_2';
	}
	if (api.openapi && api.openapi.startsWith('3.0')) {
		format = 'openapi_3';
	}
	if (api.asyncapi &&  api.asyncapi.startsWith('1.0')) {
		format = 'asyncapi_1';
	}
}

console.log('Mode: '+mode+' format: '+format);

if (format === 'openapi_3') {
	try {
		openapi3.validateSync(api, {}, function(err,options) {
			if (err) callback(err, null)
			else {
				console.log('Valid openapi 3.0.x');
				callback(null, options);
			}
		});
	}
	catch (ex) {
		console.log(ex.message);
		callback(ex, null)
	}
}
else if (format === 'asyncapi_1') {
	var validate = ajv.compile(asyncApiSchema);
	validate(api);
	var errors = validate.errors;
	if (errors) {
		console.log(JSON.stringify(errors,null,2));
		callback(errors, null);
	}
	else {
		console.log('Valid AsyncAPI 1.0.x');
		callback(null, api);
	}
}
else if (format === 'api_blueprint') {
  var drafter = require('drafter.js')
  var res = drafter.parse(api, {generateSourceMap: true}, function (err, res) {
      if (err) {
         console.log('Err: '+JSON.stringify(err))
		 callback(err, null);
      }
	  else callback(null, api);
      console.log(JSON.stringify(res));
	  console.log('Ok');
  });
}
else if (format === 'swagger_2') {
  var orig = api;
  bsc.validate(api,{dereference:{circular:'ignore'}},function(err,api){
    if (err) {
		console.log('invalid swagger 2.0');
		console.log(util.inspect(err));
	}
	else {
		console.log('Valid swagger 2.0');
		console.log(api.info.title+' '+api.info.version+' host:'+(api.host ? api.host : 'relative'));
	}
	callback(err,api||orig);
  });
}
else if (format === 'swagger_1') {
	var base = source.split('/');
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

	//if (source.endsWith('.json') || source.endsWith('.yaml')) {
	//	extension = '';
	//}

	var retrieve = [];
	var apiDeclarations = [];
	if (api.apis) {
		for (var component of api.apis) {
			component.path = component.path.replace('.{format}','.json');
			if ((base.endsWith('/')) && (component.path.startsWith('/'))) {
				base = base.substr(0,base.length-1);
			}

			var u = (base+component.path+extension);
			console.log(u);
			retrieve.push(fetch(u)
			.then(res => {
				console.log(res.status);
				return res.text();
			})
			.then(data => {
				//console.log(data);
				apiDeclarations.push(yaml.safeLoad(data,{json:true}));	
			})
			.catch(err => {
				console.log(util.inspect(err));
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
	  if (convert) {
	  	s1p.specs[sVersion].convert(api,apiDeclarations,true,function(err,converted){
			if (err) console.log(util.inspect(err));
			callback(err,converted);
		});
	  }
	  else callback(null,api);
	});  

	// https://github.com/apigee-127/swagger-tools/blob/master/docs/API.md#validaterlorso-apideclarations-callback
	
}
else if (format == 'raml') {
	var raml = require('raml-1-parser');
	var node = raml.loadApiSync(source);
	var res = node.toJSON({"rootNodeDetails":true});
	console.log('Errors: '+JSON.stringify(res.errors,null,2));
	if (res.errors) callback(res.errors,null)
	else callback(null, source);
	//console.log(JSON.stringify(node.toJSON({"rootNodeDetails":true}),null,2));
}
else console.log(mode,' ',format);

}

module.exports = {
	check_api : check_api
};
