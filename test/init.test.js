var tape = require('tape');
var fs = require('fs');
var rimraf = require('rimraf');
var path = require('path');
var lambdaCfnInit = require('../lib/init.js');

var currentDirectory = path.basename(process.cwd());

// Support running tests from both `npm test` or `node init.test.js` from test folder
switch (currentDirectory) {
  case 'lambda-cfn':
    var initialDirectory = 'test/fixtures/init/';
    break;
  case 'test':
    var initialDirectory = 'fixtures/init/';
    break;
  default:
    throw new Error('Please run tests via npm test or directly from the test directory');
}

tape('Check for existing package.json', function(t) {
  process.chdir(initialDirectory);
  lambdaCfnInit.checkPackageJson(function (err, res){
    t.error(err, 'Does not error');
    t.equal(res, 'Package.json file already exists');
    process.chdir(__dirname);
    t.end();
  });
});

tape('Create new package.json', function(t) {
  // current working directory is now /lambda-cfn/test
  process.chdir('fixtures/init/');
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
  process.chdir('fixtures/init/');
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

tape('Teardown', function(t) {
  process.chdir('..');
  rimraf('anotherFakeRule', function(err){
    if (err) console.log(err);
    rimraf('fakeFakeRule', function(err){
      if (err) console.log(err);
      t.end();
    });
  });
});