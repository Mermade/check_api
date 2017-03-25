var fs = require('fs');
var url = require('url');
var util = require('util');

var fetch = require('node-fetch');
var yaml = require('js-yaml');
var drafter = require('drafter.js')
var bsc = require('swagger-parser');
var raml = require('raml-1-parser');

//require("raml-1-parser/plugins/resourceUriValidationPlugin");
//require("raml-1-parser/plugins/crudAnnotationsValidator");
//require("raml-1-parser/plugins/uninheritedTypesDetector");
//require("raml-1-parser/plugins/xmlAnnotationsValidator");

function check_api(api,source) {
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

console.log('Mode: '+mode+' format: '+format);

if ((mode == 'text') && (api.startsWith('#') || (api.startsWith('FORMAT: '))) && (format !== 'raml')) {
	format = 'api_blueprint';
}
else {
	if (api.swagger && api.swagger == '1.2') {
		format = 'swagger_1';
	}
	if (api.swagger && api.swagger == '2.0') {
		format = 'swagger_2';
	}
}

if (format == 'api_blueprint') {
  var res = drafter.parse(api, {generateSourceMap: true}, function (err, res) {
      if (err) {
         console.log(err)
      }
      console.log(res);
  });
}
else if (format == 'swagger_2') {
  bsc.validate(api,function(err,api){
    if (err) {
		console.log('invalid swagger 2.0');
		console.log(util.inspect(err));
	}
	else {
		console.log('Valid swagger 2.0');
		console.log(api.host);
	}
  });
}
else if (format == 'swagger_1') {
	console.log('TODO');
}
else if (format == 'raml') {
	var node = raml.loadApiSync(source);
	var res = node.toJSON({"rootNodeDetails":true});
	console.log('Errors: '+JSON.stringify(res.errors,null,2));
	//console.log(JSON.stringify(node.toJSON({"rootNodeDetails":true}),null,2));
}
else console.log(mode,' ',format);

}

var u = url.parse(process.argv[2]);
if (u.protocol) {
	fetch(process.argv[2])
	.then(res => {
		return res.text();
	})
	.then(data => {
		check_api(data,process.argv[2]);
	});
}
else {
fs.readFile(process.argv[2],'utf8',function(err,data){
		check_api(data,process.argv[2]);
	});
}
