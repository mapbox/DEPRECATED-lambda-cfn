var tape = require('tape');
var lambdaCfnDeploy = require('../lib/deploy.js');
var path = require('path');

process.env.AWS_ACCOUNT_ID = 'fakefakefake';

tape('Deployment fails without a deployment command', function(t){
  t.throws(function() { lambdaCfnDeploy.deploy(); });
  t.end();
});

tape('Deployment fails without an environment name', function(t){
  t.throws(function() { lambdaCfnDeploy.deploy('create'); });
  t.end();
});

tape('Deployment fails if cfn config bucket not defined and $CFN_CONFIG_BUCKET is undefined', function(t) {
  console.log(path.join(__dirname, 'fixtures/deploy'));
  process.chdir(path.join(__dirname, 'fixtures/deploy'));
  delete process.env.CFN_CONFIG_BUCKET;
  t.throws(function() { lambdaCfnDeploy.deploy('create', 'development') });
  t.end();
});

tape('Deployment fails if template bucket not defined and $AWS_ACCOUNT_ID is undefined', function(t) {
  process.env.CFN_CONFIG_BUCKET = 'fakefakefake';
  delete process.env.AWS_ACCOUNT_ID;
  t.throws(function() { lambdaCfnDeploy.deploy('create', 'development') });
  process.chdir('../../..');
  t.end();
});