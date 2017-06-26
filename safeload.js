var fs = require('fs');

var yaml = require('js-yaml');

if (process.argv.length>2) {
  var obj = yaml.safeLoad(fs.readFileSync(process.argv[2],'utf8'),{json:true});
  console.log(JSON.stringify(obj,null,2));
}
else {
  console.log('Usage: safeload {filename}');
}
