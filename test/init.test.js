var tape = require('tape');
var fs = require('fs');
var rimraf = require('rimraf');
var path = require('path');
var lambdaCfnInit = require('../lib/init.js');

tape('Check for existing package.json that already has lambda-cfn', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  lambdaCfnInit.checkPackageJson(function (err, res){
    t.error(err, 'Does not error');
    t.equal(res, 'Package.json already exists and lambda-cfn is a dependency');
    process.chdir(__dirname);
    t.end();
  });
});

tape('Add lambda-cfn as a dependency to existing package.json', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/init/incomplete'));
  lambdaCfnInit.checkPackageJson(function (err, res){
    t.error(err, 'Does not error');
    t.equal(res, 'Added lambda-cfn as a dependency to existing package.json');
    process.chdir(__dirname);
    t.end();
  });
});

tape('Create new package.json if it does not exist', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  fs.mkdir('anotherFakeRule', function (err, response) {
    process.chdir('anotherFakeRule');
    lambdaCfnInit.checkPackageJson(function (err, res) {
      t.error(err, 'Does not error');
      t.equal(res, 'Created package.json file');
      process.chdir(__dirname);
      t.end();
    });
  });
});

tape('Create function directory and files', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  lambdaCfnInit.createFunctionFiles('fakeFakeRule', function(err, res) {
    t.error(err, 'Does not error');
    t.equal(res, 'Created fakeFakeRule/function.js and fakeFakeRule/function.template.js files')
    t.end();
  });
});

tape('Creating function with bad stack name fails', function(t) {
  t.throws(function() { lambdaCfnInit.createFunctionFiles('123-badRule', 
    function(err, res){ }) },/Not a valid AWS CloudFormation stack name - must contain only letters, numbers, dashes and start with an alpha character/);
  t.end();
});

tape('Teardown - delete folders', function(t) {
  process.chdir('..');
  rimraf('anotherFakeRule', function(err){
    if (err) console.log(err);
    rimraf('fakeFakeRule', function(err){
      if (err) console.log(err);
      t.end();
    });
  });
});

tape('Teardown - restore package.json file', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/init/incomplete'));

  var content = {
    "name": "incomplete",
    "version": "0.0.0",
    "dependencies": {
      "request": "2.81.0",
      "express": "4.15.3"
    }
  };

  fs.writeFile('package.json', JSON.stringify(content, null, 2), function(err){
    if (err) console.error(err);
    process.chdir(__dirname);
    t.end();
  });

});