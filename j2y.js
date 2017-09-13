var fs = require('fs');
var yaml = require('js-yaml');

if (process.argv.length<3) {
    console.log('Usage: j2y {infile} {outfile}');
}
else {
    var s = fs.readFileSync(process.argv[2],'utf8');
    var obj = yaml.safeLoad(s,{json:true});
    fs.writeFileSync(process.argv[3],yaml.safeDump(obj,{lineWidth:-1}),'utf8');
}

