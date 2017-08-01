#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var argv = require('minimist')(process.argv);

if (!argv._[2]) {
  console.log('Please provide a name for the function');
  process.exit(1);
}

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

function createFunctionFiles() {
  // TODO - validate name against CloudFormation stack name limitations
  var directoryName = argv._[2];
  fs.mkdir(directoryName, function(err, response) {
    if (err) throw (err);
    process.chdir(directoryName);
    var files = fs.readdirSync(process.cwd());
    if (files.indexOf('function.js') === -1) {
      var functionJsContent = 'var lambdaCfn = require(\'lambda-cfn\'); \n\n'
        + 'module.exports.fn = function(event, context, callback) { \n'
        + '// write Lambda function code here \n \n};';
      fs.writeFile('function.js', functionJsContent, function(err, file){
        if (err) throw err;
        console.log('Created ' + directoryName + '/function.js file')
      });
    }
    if (files.indexOf('function.template.js') === -1) {
      fs.writeFile('function.template.js', 'function.template.js file', function(err, file){
        if (err) throw err;
        console.log('Created ' + directoryName + '/function.template.js file')
      });
    }
  });
}

checkPackageJson();
createFunctionFiles();