var tape = require('tape');
var fs = require('fs');
var rimraf = require('rimraf');
var path = require('path');
var lambdaCfn = require('../index.js');

tape('Check for existing package.json that already has lambda-cfn', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  fs.createReadStream('package.json.orig').pipe(fs.createWriteStream('package.json'));
  lambdaCfn.init.checkPackageJson(function(err, res) {
    t.error(err, 'Does not error');
    t.equal(res, 'Package.json @mapbox/lambda-cfn dependency updated to ^2.0.0');
    process.chdir(__dirname);
    t.end();
  });
});

tape('Add lambda-cfn as a dependency to existing package.json', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/init/incomplete'));
  fs.createReadStream('package.json.orig').pipe(fs.createWriteStream('package.json'));
  lambdaCfn.init.checkPackageJson(function(err, res){
    t.error(err, 'Does not error');
    t.equal(res, 'Added @mapbox/lambda-cfn ^2.0.0 as a dependency to existing package.json');
    process.chdir(__dirname);
    t.end();
  });
});

tape('Create new package.json if it does not exist', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  fs.mkdir('anotherFakeRule', function(err) {
    t.error(err, 'Does not error');
    process.chdir('anotherFakeRule');
    lambdaCfn.init.checkPackageJson(function(err, res) {
      t.error(err, 'Does not error');
      t.equal(res, 'Created package.json file');
      process.chdir(__dirname);
      t.end();
    });
  });
});

tape('Create function directory and files', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  lambdaCfn.init.createFunctionFiles('fakeFakeRule', function(err, res) {
    t.error(err, 'Does not error');
    t.equal(res, 'Created function skeleton files');
    t.end();
  });
});

tape('init called within existing function directory', function(t) {
  lambdaCfn.init.checkPackageJson(function(err) {
    t.equal(err, 'ERROR: init called within existing function directory, unsupported behavior, exiting');
    t.end();
  });
});

tape('Creating function with bad stack name fails', function(t) {
  lambdaCfn.init.createFunctionFiles('123-badRule', function(err){
    t.equal(err,'Not a valid AWS CloudFormation stack name - must contain only letters, numbers, dashes and start with an alpha character');
    t.end();
  });
});

tape('Cleaning up after tests...', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  t.comment('Cleaning up fixtures/init/package.json');
  fs.unlinkSync('./package.json');
  t.comment('Cleaning up fixtures/init/incomplete/package.json');
  fs.unlinkSync('./incomplete/package.json');
  process.chdir(path.join(__dirname, 'fixtures/init'));
  rimraf('anotherFakeRule', function(err){
    if (err) console.log(err);
    rimraf('fakeFakeRule', function(err){
      if (err) console.log(err);
      t.comment('Complete!');
      t.end();
    });
  });
});
