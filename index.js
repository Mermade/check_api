'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');
const util = require('util');

const fetch = require('node-fetch');
const co = require('co');
const yaml = require('yaml');
yaml.defaultOptions.prettyErrors = true;
const jsy = require('js-yaml');
const swagger2openapi = require('swagger2openapi');
const openapi3 = require('oas-validator');
const asyncApiSchema1 = require('asyncapi/schemas/1.2.0.json');
const asyncApiSchema2 = require('asyncapi/schemas/2.0.0.json');
const ss = require('@exodus/schemasafe').validator;
const recurse = require('reftools/lib/recurse').recurse;

//require("raml-1-parser/plugins/resourceUriValidationPlugin");
//require("raml-1-parser/plugins/crudAnnotationsValidator");
//require("raml-1-parser/plugins/uninheritedTypesDetector");
//require("raml-1-parser/plugins/xmlAnnotationsValidator");

//https://schema.getpostman.com/

function check_api(api,options,callback) {
options.mode = 'text';
options.format = 'none';

if (typeof api === 'object') {
    options.mode = 'json';
}
else if (typeof api === 'string') {
    api = api.split('\r\n').join('\n').split('\r').join('').split('---').join('###');
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
        try {
            api = yaml.parse(api||'');
            options.mode = 'yaml';
        }
        catch (ex) {
            console.warn(ex.message,ex.linePos);
            console.warn('Falling back to js-yaml');
            api = jsy.safeLoad(api||'');
            options.mode = 'yaml';
        }
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
    else if (api && api.swagrVersion) {
        options.format = 'swagger_1';
        options.patchSwagr = true;
    }
    else if (api && api.swagger && api.swagger === '2.0') {
        options.format = 'swagger_2';
    }
    else if (api && api.swagger) {
    console.warn('Unknown swagger version: '+api.swagger);
    }
    else if (api && api.openapi && (typeof api.openapi === 'string') && api.openapi.startsWith('3.0')) {
        options.format = 'openapi_3';
    }
    else if (api && api.openapi) {
    console.warn('Unknown openapi version: '+api.openapi);
    }
    else if (api && api.asyncapi && (typeof api.asyncapi === 'string') && api.asyncapi.startsWith('1.')) {
        options.format = 'asyncapi_1';
    }
    else if (api && api.asyncapi && (typeof api.asyncapi === 'string') && api.asyncapi.startsWith('2.')) {
        options.format = 'asyncapi_2';
    }
    else if (api && api.asyncapi) {
        console.warn('Unknown asyncapi version: '+api.asyncapi);
    }
    else if (api && api.version) {
        console.warn('Kin!');
        options.format = 'asyncapi_1';
        api.asyncapi = api.version;
        delete api.version;
        recurse(api,{},function(obj,key,state){
            if (key === 'asyncapi_servers_variables') {
                obj.variables = obj.asyncapi_servers_variables;
                delete obj.asyncapi_servers_variables;
            }
        });
    }
}

if (options.format === 'openapi_3') {
    var options = {laxRefs:true,resolve:true,source:options.source,convert:options.convert,verbose:1};
    try {
        openapi3.validate(api, options, function(err, opts) {
            if (err) {
                return callback(err, err.options||opts||options);
            }
            options.converted = options.openapi||api;
            options.message = 'Valid openapi 3.0.x';
            options.context = [api.info.version + ' ' +
            (api.servers && api.servers.length ? api.servers[0].url : 'Relative')];
            callback(null, options);
        });
    }
    catch (ex) {
        var context = options.context.pop();
        options.context = [context];
        callback(ex, options);
    }
}
else if (options.format === 'asyncapi_1') {
    const validate = ss(asyncApiSchema1);
    validate(api);
    var errors = validate.errors;
    if (errors) {
        callback(errors, options);
    }
    else {
        options.message = 'Valid AsyncAPI 1.x';
        callback(null, options);
    }
}
else if (options.format === 'asyncapi_2') {
    const validate = ss(asyncApiSchema2);
    validate(api);
    var errors = validate.errors;
    if (errors) {
        callback(errors, options);
    }
    else {
        options.message = 'Valid AsyncAPI 2.x';
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
  const options = { resolve: true, patch: true, warnOnly: true };
  swagger2openapi.convertObj(api,options,function(err,options){
    api = options.openapi;
    openapi3.validate(api,options,function(err,options){
    if (api && (!api.info || !api.info.title)) {
        err = {error:'No title'};
    }
    if (err || !options.valid) {
        if (!options) options = {};
        options.message = 'Invalid swagger 2.0';
    }
    else {
        options.message = 'Valid swagger 2.0';
        if (options.patches) options.message += ' (with '+options.patches+' patches)';
        options.context = [api.info.title+' '+api.info.version+
        ' host:'+(api.host ? api.host : 'relative')];
        if (api.info["x-logo"] && api.info["x-logo"].url) {
            options.context[0] += '\nHas logo: '+api.info["x-logo"].url;
        }
    }
    options.api = api||orig;
    callback(err, options);
  });
  });
}
else if (options.format === 'swagger_1') {
    const err = {};
    err.message = 'Swagger 1.x is no longer supported';
    callback(err,options);
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
    const err = {};
    err.message = 'No format/type detected';
    callback(err,options);
}

}

module.exports = {
    check_api : check_api
};
