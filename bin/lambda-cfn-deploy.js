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

if (argv.name) {
  var stackName = argv.name;
} else {
  var stackName = path.basename(process.cwd());
}

if (argv.template) {
  var template = argv.template;
} else {
  var template = path.join(process.cwd(), 'function.template.js');
}

if (argv.cfnConfigbucket) {
  var cfnConfigBucket = argv.cfnConfigbucket;
} else {
  var cfnConfigBucket = process.env.CFN_CONFIG_BUCKET;
}

if (argv.region) {
  var region = argv.region;
} else {
  var region = process.env.AWS_DEFAULT_REGION;
}

if (argv.templateBucket) {
  var templateBucket = argv.templateBucket;
} else {
  var templateBucket = 'cfn-config-templates-' + process.env.AWS_ACCOUNT_ID + '-' + region;
}

lambdaCfnDeploy.deploy(command, stackName, environment, template, region, cfnConfigBucket, templateBucket);