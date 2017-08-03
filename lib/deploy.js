module.exports.deploy = deploy;

var cfnConfig = require('@mapbox/cfn-config');
var git = require('git-rev-sync');
var path = require('path');

function deploy(command, environment, stackName, template, region, cfnConfigBucket, templateBucket) {

  if (command === undefined) {
    throw new Error('Please provide a valid deployment command');
  }
  if (environment === undefined) {
    throw new Error('Please provide an environment name');
  }
  if (stackName === undefined) {
    stackName = path.basename(process.cwd());
  }
  if (template === undefined) {
    template = path.join(process.cwd(), 'function.template.js');
  }
  if (region === undefined) {
    region = process.env.AWS_DEFAULT_REGION;
  }
  if (cfnConfigBucket === undefined) {
    if (process.env.CFN_CONFIG_BUCKET === undefined) {
      throw new Error('$CFN_CONFIG_BUCKET not defined and cfn-config S3 bucket not provided');
    }
    cfnConfigBucket = process.env.CFN_CONFIG_BUCKET;
  }
  if (templateBucket === undefined) {
    if (process.env.AWS_ACCOUNT_ID === undefined) {
      throw new Error('$AWS_ACCOUNT_ID not defined and template S3 bucket not provided');
    }
    templateBucket = 'cfn-config-templates-' + process.env.AWS_ACCOUNT_ID + '-' + region;;
  }

  var options = {
    name: stackName,
    region: region,
    configBucket: cfnConfigBucket,
    templateBucket: templateBucket
  }

  var commands = cfnConfig.commands(options);

  var overrides = {
    parameters: { GitSha: git.long(process.cwd()) },
  };

  switch (command) {
    case 'create':
      commands.create(environment, template, overrides, function (err) {
        if (err) console.error(`Create failed: ${err.message}`);
        else console.log('Create succeeded');
      });
      break;
    case 'update':
      commands.update(environment, template, function (err) {
        if (err) console.error(`Update failed: ${err.message}`);
        else console.log('Update succeeded');
      });
      break;
    case 'save':
      commands.save(environment, function (err) {
        if (err) console.error(`Failed to save configuration: ${err.message}`);
        else console.log('Saved configuration');
      });
      break;
    case 'info':
      commands.info(environment, function(err, info) {
        if (err) console.error(`Failed to read stack info: ${err.message}`);
        else console.log(JSON.stringify(info, null, 2));
      });
      break;
    case 'delete':
      commands.delete(environment, function(err) {
        if (err) console.error(`Delete failed: ${err.message}`);
        else console.log('Delete succeeded');
      });
      break;
  }

}