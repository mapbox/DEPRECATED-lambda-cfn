module.exports.init = init;

var fs = require('fs');
var path = require('path');

function checkPackageJson() {
  var directoryName = path.basename(process.cwd());
  var files = fs.readdirSync(process.cwd());
  if (files.indexOf('package.json') === -1) {
    var content = {
      "name": directoryName,
      "version": "0.0.0",
      "dependencies": {
        "lambda-cfn": "*"
      }
    };
    fs.writeFile('package.json', JSON.stringify(content, null, 2), function(err, file) {
      if (err) throw err;
      console.log('Created package.json file');
    });
  } else {
    console.log('Package.json file already in this directory');
    // TODO add checks for valid package.json and required dependencies
  }
}

function createFunctionFiles(name) {
  
  var regExp = /^[a-zA-Z][a-zA-Z0-9-]+$/;
  
  if (name.match(regExp) === null) {
    throw new Error('Not a valid AWS CloudFormation stack name - must contain only letters, numbers, dashes and start with an alpha character');
  }

  fs.mkdir(name, function(err, response) {
    if (err) throw (err);
    process.chdir(name);
    var files = fs.readdirSync(process.cwd());
    
    if (files.indexOf('function.js') === -1) {
      var functionJsContent = 'var lambdaCfn = require(\'lambda-cfn\'); \n\n'
        + 'module.exports.fn = function(event, context, callback) { \n'
        + '// write Lambda function code here \n \n};';
      fs.writeFile('function.js', functionJsContent, function(err, file){
        if (err) throw err;
        console.log('Created ' + name + '/function.js file')
      });
    }

    if (files.indexOf('function.template.js') === -1) {
      var functionTemplateContent = 'var lambdaCfn = require(\'lambda-cfn\'); \n\n'
        + 'module.exports = lambdaCfn.build({\n'
        + '  name: \'' + name + '\'\n'
        + '});';
      fs.writeFile('function.template.js', functionTemplateContent, function(err, file){
        if (err) throw err;
        console.log('Created ' + name + '/function.template.js file')
      });
    }
  });
}

function init(name) {
  checkPackageJson();
  createFunctionFiles(name);
}