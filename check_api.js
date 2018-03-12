#!/usr/bin/env node

var fs = require('fs');
var https = require('https');
var url = require('url');
var util = require('util');

var fetch = require('node-fetch');

var check_api = require('./index.js');

var red = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[31m';
var green = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[32m';
var normal = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[0m';

var options = {};
options.source = process.argv[2];
options.convert = process.argv.length>3;
options.fetchOptions = {};

options.fetchOptions.headers = { "Accept-Language": "en-GB,en;q=0.5" };

function result(err,options) {
    if (options.convert && options.converted) {
        fs.writeFileSync(process.argv[3],JSON.stringify(options.converted,null,2),'utf8');
    }
    if (options && options.format && options.mode) {
    	console.log(normal+'Mode: %s, format: %s',options.mode,options.format);
    }
    if (err) {
        if (err.message) {
            console.error(red+err.message);
            if (err.stack && err.name !== 'AssertionError') {
                console.log(err.stack);
            }
        }
        else {
            console.error(red+util.inspect(err,{depth:4}));
        }
    }
    else process.stdout.write(green);
    if (options && options.output) console.log(util.inspect(options.output));
    if (options && options.message) console.log(options.message);
    if (options && options.context) {
        let context = options.context.pop();
        console.log(context);
    }
    if (!err) process.exitCode = 0;
    console.log('Exiting with result code: %s',process.exitCode);
}

process.exitCode = 1;
if (process.argv.length<3) {
    console.log('Usage: node check_api {url-or-filename} [{convert-filename}]');
    process.exit();
}
var u = url.parse(process.argv[2]);
if (u.protocol && u.protocol.startsWith('http')) {
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
