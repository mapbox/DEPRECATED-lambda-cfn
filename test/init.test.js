const path = require('path');
const fs = require('fs');
const tape = require('tape');
const rimraf = require('rimraf');
const lambdaCfn = require('../index.js');

tape('Check for existing package.json that already has lambda-cfn', (t) => {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  fs.createReadStream('package.json.orig')
    .pipe(fs.createWriteStream('package.json'))
    .on('finish', () => lambdaCfn.init.checkPackageJson((err, res) => {
      t.error(err, 'Does not error');
      t.equal(res, 'Package.json @mapbox/lambda-cfn dependency updated to ^3.1.0');
      process.chdir(__dirname);
      t.end();
    }));
});

tape('Add lambda-cfn as a dependency to existing package.json', (t) => {
  process.chdir(path.join(__dirname, 'fixtures/init/incomplete'));
  fs.createReadStream('package.json.orig').
    pipe(fs.createWriteStream('package.json'))
    .on('finish', () => lambdaCfn.init.checkPackageJson((err, res) => {
      t.error(err, 'Does not error');
      t.equal(res, 'Added @mapbox/lambda-cfn ^3.1.0 as a dependency to existing package.json');
      process.chdir(__dirname);
      t.end();
    }));
});

tape('Create new package.json if it does not exist', (t) => {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  fs.mkdir('anotherFakeRule', (err) => {
    t.error(err, 'Does not error');
    process.chdir('anotherFakeRule');
    lambdaCfn.init.checkPackageJson((err, res) => {
      t.error(err, 'Does not error');
      t.equal(res, 'Created package.json file');
      process.chdir(__dirname);
      t.end();
    });
  });
});

tape('Create function directory and files', (t) => {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  lambdaCfn.init.createFunctionFiles('fakeFakeRule', (err, res) => {
    t.error(err, 'Does not error');
    t.equal(res, 'Created function skeleton files');
    t.end();
  });
});

tape('init called within existing function directory', (t) => {
  lambdaCfn.init.checkPackageJson((err) => {
    t.equal(err, 'ERROR: init called within existing function directory, unsupported behavior, exiting');
    t.end();
  });
});

tape('Creating function with bad stack name fails', (t) => {
  lambdaCfn.init.createFunctionFiles('123-badRule', (err) => {
    t.equal(err,'Not a valid AWS CloudFormation stack name - must contain only letters, numbers, dashes and start with an alpha character');
    t.end();
  });
});

tape('Cleaning up after tests...', (t) => {
  process.chdir(path.join(__dirname, 'fixtures/init'));
  t.comment('Cleaning up fixtures/init/package.json');
  fs.unlinkSync('./package.json');
  t.comment('Cleaning up fixtures/init/incomplete/package.json');
  fs.unlinkSync('./incomplete/package.json');
  process.chdir(path.join(__dirname, 'fixtures/init'));
  rimraf('anotherFakeRule', (err) => {
    if (err) console.log(err);
    rimraf('fakeFakeRule', (err) => {
      if (err) console.log(err);
      t.comment('Complete!');
      t.end();
    });
  });
});
