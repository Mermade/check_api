#!/usr/bin/env node

'use strict';

const fs = require('fs');
const yaml = require('yaml');
const jsy = require('js-yaml');

if (process.argv.length<3) {
    console.log('Usage: j2y {infile} {outfile}');
}
else {
    var s = fs.readFileSync(process.argv[2],'utf8');
    var obj;
    try {
      obj = yaml.parse(s);
    }
    catch (ex) {
      obj = jsy.safeLoad(s,{json:true});
    }
    fs.writeFileSync(process.argv[3],yaml.stringify(obj),'utf8');
}

