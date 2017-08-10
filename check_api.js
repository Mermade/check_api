#!/usr/bin/env node

var fs = require('fs');
var https = require('https');
var url = require('url');
var util = require('util');

var fetch = require('node-fetch');

var check_api = require('./index.js');

var convert = process.argv.length>3;

function result(err,converted) {
	if (convert && converted) {
		fs.writeFileSync(process.argv[3],JSON.stringify(converted,null,2),'utf8');
	}
	if (!err) process.exitCode = 0;
}

process.exitCode = 1;
var u = url.parse(process.argv[2]);
if (u.protocol) {
	var options = {};
	if (u.protocol.startsWith('https')) {
		options.agent = new https.Agent({rejectUnauthorized: false});
	}
	fetch(process.argv[2],options)
	.then(res => {
		return res.text();
	})
	.then(data => {
		check_api.check_api(data,process.argv[2],convert,result);
	});
}
else {
	fs.readFile(process.argv[2],'utf8',function(err,data){
		check_api.check_api(data,process.argv[2],convert,result);
	});
}
