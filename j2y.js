#!/usr/bin/env node

'use strict';

const fs = require('fs');
const yaml = require('yaml');
const jsy = require('./lib/js-yaml.min.js');

if (process.argv.length<3) {
    console.log('Usage: j2y {infile} {outfile}');
}
else {
    const s = fs.readFileSync(process.argv[2],'utf8');
    let obj;
    try {
      obj = yaml.parse(s);
    }
    catch (ex) {
      console.warn(ex.message);
      console.warn('Falling back to js-yaml');
      obj = jsy.safeLoad(s,{json:true});
    }
    fs.writeFileSync(process.argv[3],yaml.stringify(obj),'utf8');
}

