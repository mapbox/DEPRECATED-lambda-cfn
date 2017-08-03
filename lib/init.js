module.exports.init = init;
module.exports.checkPackageJson = checkPackageJson;
module.exports.createFunctionFiles = createFunctionFiles;

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

function checkPackageJson(callback) {
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
      callback(null, 'Created package.json file');
    });
  } else {
    fs.readFile('package.json', 'utf-8', function(err, data){
      if (err) console.error(err)
      var content = JSON.parse(data);
      var dependencies = Object.keys(content.dependencies);
      if (_.includes(dependencies, 'lambda-cfn')) {
        callback(null, 'Package.json already exists and lambda-cfn is a dependency');
      } else {
        var newDependencies = _.assign(content.dependencies, {'lambda-cfn': '*'});
        fs.writeFile('package.json', JSON.stringify(content, null, 2), function(err){
          callback(null, 'Added lambda-cfn as a dependency to existing package.json');
        });
      }
    });
  }
}

function createFunctionFiles(name, callback) {
  
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
        if (files.indexOf('function.template.js') === -1) {
          var functionTemplateContent = 'var lambdaCfn = require(\'lambda-cfn\'); \n\n'
            + 'module.exports = lambdaCfn.build({\n'
            + '  name: \'' + name + '\'\n'
            + '});';

          fs.writeFile('function.template.js', functionTemplateContent, function(err, file){
            if (err) throw err;
            callback(null, 'Created ' + name + '/function.js and ' + name + '/function.template.js files');
          });
        }
      });
    }
  });
}

function init(name) {
  checkPackageJson(function(err, res){ 
    if (err) console.log(err);
    console.log(res);
  });
  createFunctionFiles(name, function(err, res){
    if (err) console.log(err);
    console.log(res);
  });
}