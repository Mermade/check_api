# Check_API

`check_api` is a simple utility wrapping a collection of API definition format validators. It allows you to validate a local file or remote URL with a single command-line or programmatic invocation.

It returns an exitCode of 0 on success and 1 on failure, making it suitable for use in Continuous Integration environments.

## Supported Formats

* Swagger 1.2
* Swagger / OpenAPI 2.0
* OpenAPI 3.0.x
* RAML 
* API Blueprint
* AsyncAPI 1.x

## Planned

* IO Docs
* WADL
* Google Discovery Format

## API

```javascript
const check_api = require('check_api');
const options = {};
options.source = 'url_or_filename';
options.convert = false; 
//options.fetchOptions = {...};
check_api.check_api(string_or_object,options,callback);
```
