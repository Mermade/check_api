#!/usr/bin/env node

'use strict';

var fs = require('fs');
var yaml = require('js-yaml');

if (process.argv.length<3) {
    console.log('Usage: y2j {infile} {outfile}');
}
else {
    var s = fs.readFileSync(process.argv[2],'utf8');
    var obj = yaml.safeLoad(s,{json:true});
    fs.writeFileSync(process.argv[3],JSON.stringify(obj,null,2),'utf8');
}

