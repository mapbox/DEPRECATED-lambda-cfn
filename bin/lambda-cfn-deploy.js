#!/usr/bin/env node
var path = require('path');
var argv = require('minimist')(process.argv);
var lambdaCfnDeploy = require('../lib/deploy.js');

if (!argv._[2]) {
  console.log('Please provide a deployment command');
  process.exit(1);
}
if (!argv._[3]) {
  console.log('Please provide an environment name');
  process.exit(1);
}

var command = argv._[2];
var environment = argv._[3];

lambdaCfnDeploy.deploy(command, environment, argv.name, argv.template, argv.region, argv.cfnConfigbucket, argv.templateBucket);