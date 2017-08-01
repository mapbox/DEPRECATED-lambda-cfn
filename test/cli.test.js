var tape = require('tape');
var cli = require('../lib/cli');
var path = require('path');
var fs = require('fs');
var rimraf = require('rimraf');

process.env.AWS_ACCOUNT_ID = 'fakefakefake';

tape('Deployment fails without a deployment command', function(t){
  t.throws(function() { cli(); });
  t.end();
});

tape('Deployment fails without an environment name', function(t){
  t.throws(function() { cli('create'); });
  t.end();
});

tape('Deployment fails if cfn config bucket not defined and $CFN_CONFIG_BUCKET is undefined', function(t) {
  process.chdir(path.join(__dirname, 'fixtures/deploy'));
  delete process.env.CFN_CONFIG_BUCKET;
  t.throws(function() {
    cli('create', 'development');
  });
  t.end();
});

tape('Deployment fails if template bucket not defined and $AWS_ACCOUNT_ID is undefined', function(t) {
  process.env.CFN_CONFIG_BUCKET = 'fakefakefake';
  delete process.env.AWS_ACCOUNT_ID;
  t.throws(function() {
    cli('create', 'development');
  });
  process.chdir('../../..');
  t.end();
});

tape('parse init command', function(t) {
  t.throws(function() {
    cli.parse(['init'], process.env);
  }, /Please provide a function name/, 'Throws when no environment');
  t.throws(function() {
    cli.parse(['init', 'name', '--all'], process.env);
  }, /init tobogganing not currently/, 'Throws when init and --all are passed together');
  var def = cli.parse(['init', 'name'], process.env);
  t.notOk(def.overrides.parameters.GitSha,'init does not require GitSha');
  t.notOk(def.options.name, 'init does not set name');
  t.end();
});

tape('cli.parse tests', function(t) {
  var parsed = {
    command: 'init',
    environment: 'testFunction'
  };
  process.chdir('test/fixtures/');
  cli.main(parsed, function(err) {
    t.error(err,'init function does not error');
    process.env.AWS_ACCOUNT_ID = 'fake';
    var def = cli.parse(['create','test'], process.env);
    t.equal(def.options.name, 'fixtures-testFunction', 'function name set correctly');
    t.ok(def.overrides.parameters.GitSha, 'Gitsha is present in cfn-config overrides');
    fs.unlinkSync('function.template.js');
    t.throws(function() {
      cli.parse(['create','test'], process.env);
    }, 'parsing fails if no template found');
    process.chdir('..');
    t.comment(process.cwd());
    rimraf('testFunction', function(err) {
      t.error(err);
      t.comment('Cleaning up testFunction directory');
      t.end();
    });
  });
});
