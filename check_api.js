#!/usr/bin/env node

var fs = require('fs');
var https = require('https');
var url = require('url');
var util = require('util');

var fetch = require('node-fetch');

var check_api = require('./index.js');

var options = {};
options.source = process.argv[2];
options.convert = process.argv.length>3;
options.fetchOptions = {};

function result(err,converted) {
    if (options.convert && converted) {
        fs.writeFileSync(process.argv[3],JSON.stringify(converted,null,2),'utf8');
    }
    if (!err) process.exitCode = 0;
}

process.exitCode = 1;
if (process.argv.length<3) {
    console.log('Usage: node check_api {url-or-filename} [{convert-filename}]');
    process.exit();
}
var u = url.parse(process.argv[2]);
if (u.protocol) {
    if (u.protocol.startsWith('https')) {
        options.fetchOptions.agent = new https.Agent({rejectUnauthorized: false});
    }
    fetch(process.argv[2],options.fetchOptions)
    .then(res => {
        return res.text();
    })
    .then(data => {
        check_api.check_api(data,options,result);
    });
}
else {
    fs.readFile(process.argv[2],'utf8',function(err,data){
        check_api.check_api(data,options,result);
    });
}
