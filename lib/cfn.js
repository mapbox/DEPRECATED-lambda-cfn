const cf = require('@mapbox/cloudfriend');

const webhookArtifact = require('./artifacts/webhook');
const snsArtifact = require('./artifacts/sns');
const cloudWatchArtifact = require('./artifacts/cloudwatch');
const roleArtifact = require('./artifacts/roles');
const alarmArtifact = require('./artifacts/alarms');
const dispatchArtifact = require('./artifacts/dispatch');
const lambdaArtifact = require('./artifacts/lambda');
const parametersArtifact = require('./artifacts/parameters');
const destinationArtifact = require('./artifacts/destination');

function buildFunctionTemplate(options) {
  let template = buildFunction(options);
  template.AWSTemplateFormatVersion = '2010-09-09';
  template.Description = `${options.name} lambda-cfn function`;
  return template;
}

// builds an embeddable json Cloudformation template for a single function
function buildFunction(options) {
  if (!options.name) {
    throw new Error('Function name is required');
  }

  let parameters = parametersArtifact.buildParameters(options);
  let defaultAlarms = alarmArtifact.buildServiceAlarms(options);
  let lambda = lambdaArtifact.buildLambda(options);
  let role = roleArtifact.buildRole(options);
  let cloudwatchEvent = {};
  let schedule = {};
  let sns = {};
  let webhook = {};
  let snsDestination = {};

  // if no event source specified default to an SNS rule
  let hasEventSources = options.eventSources && options.eventSources !== {};
  if (!hasEventSources) {
    sns = snsArtifact.buildSnsEvent(options);
  }

  // only one of each event source type can be specified by a function
  if (options.eventSources) {
    for (let event in options.eventSources) {
      switch(event) {
        case 'cloudwatchEvent':
          cloudwatchEvent = cloudWatchArtifact.buildCloudwatchEvent(options, 'cloudwatchEvent');
          break;
        case 'schedule':
          schedule = cloudWatchArtifact.buildCloudwatchEvent(options, 'schedule');
          break;
        case 'sns':
          sns = snsArtifact.buildSnsEvent(options);
          break;
        case 'webhook':
          webhook = webhookArtifact.buildWebhookEvent(options);
          break;
        default:
          throw new Error(`Unknown event source specified: ${event}`);
      }
    }
  }

  // defaults to SNS Destination if none specified
  if (options.destinations) {
    for (let destination in options.destinations) {
      switch(destination) {
        case 'sns':
          snsDestination = destinationArtifact.buildSnsDestination(options);
          break;
        default:
          throw new Error(`Unknown destination specified: ${destination}`);
      }
    }
  }

  let functionTemplate = compileFunction(
    parameters,
    role,
    defaultAlarms,
    lambda,
    cloudwatchEvent,
    schedule,
    sns,
    webhook,
    snsDestination
  );

  dispatchArtifact.addDispatchSupport(functionTemplate, options);

  // Sanity check after template compilation since
  // functions may add their own Parameter dependencies
  if (Object.keys(functionTemplate.Parameters).length > 60) {
    throw new Error('More than 60 parameters specified');
  }

  // since build functions may create their own parameters outside of
  // the buildParameters step, this is called after all functions
  // have been run, gathers all parameters and injects them into the lambda
  // environment configuration
  // TODO: is this possible when embedding?

  if (!functionTemplate.Variables) {
    functionTemplate.Variables = {};
  }
  // make some global env vars available
  functionTemplate.Variables.StackName = cf.stackName;
  functionTemplate.Variables.Region = cf.region;
  functionTemplate.Variables.AccountId = cf.accountId;
  functionTemplate.Variables.StackId = cf.stackId;

  for (let param in functionTemplate.Parameters) {
    functionTemplate.Variables[param] = cf.ref(param);
  }

  if (!functionTemplate.Resources) {
    functionTemplate.Resources[options.name] = {};
  }

  functionTemplate.Resources[options.name].Properties.Environment.Variables = functionTemplate.Variables;

  // Variables object is not valid CFN
  delete functionTemplate.Variables;

  // compile any additional built-in policy objects into role
  if (functionTemplate.Policies) {
    let lambdaCFNRoles = ['LambdaCfnRole', 'LambdaCfnDispatchRole'];
    for (let lambdaRole in lambdaCFNRoles) {
      functionTemplate.Resources[lambdaRole].Properties.Policies.push(functionTemplate.Policies);
    }
    delete functionTemplate.Policies;
  }

  return functionTemplate;
}

/**
 * Takes a list of object and merges them into a template stub
 */
function compileFunction() {
  let template = {};

  if (arguments) {
    for (let arg of arguments) {
      mergeArgumentsTemplate(template, arg, 'Metadata');
      mergeArgumentsTemplate(template, arg, 'Parameters');
      mergeArgumentsTemplate(template, arg, 'Mappings');
      mergeArgumentsTemplate(template, arg, 'Conditions');
      mergeArgumentsTemplate(template, arg, 'Resources');
      mergeArgumentsTemplate(template, arg, 'Outputs');
      mergeArgumentsTemplate(template, arg, 'Variables');
      let areValidPolicies = arg.Policies && Array.isArray(arg.Policies) && arg.Policies.length > 0;
      if (areValidPolicies) {
        if (!template.Policies) {
          template.Policies = [];
        }
        template.Policies = template.Policies.concat(arg.Policies);
      }
    }
  }

  return template;
}

/**
 * Merge arguments with template arguments
 * @param template
 * @param arg
 * @param propertyName
 */
function mergeArgumentsTemplate(template, arg, propertyName) {
  if (!template.hasOwnProperty(propertyName)) {
    template[propertyName] = {};
  }

  if (arg.hasOwnProperty(propertyName)) {

    if (!arg[propertyName]) {
      arg[propertyName] = {};
    }

    Object.keys(arg[propertyName]).forEach((key) => {
      if (template[propertyName].hasOwnProperty(key)) {
        throw new Error(propertyName + ' name used more than once: ' + key);
      }

      template[propertyName][key] = JSON.parse(JSON.stringify(arg[propertyName][key]));
    });
  }
}

module.exports = buildFunctionTemplate; // returns full template
module.exports.embed = buildFunction; // returns only lambda resources for template merge
module.exports.buildFunction = buildFunction;
module.exports.compileFunction = compileFunction;
module.exports.buildFunctionTemplate = buildFunctionTemplate;
module.exports.buildWebhookEvent = webhookArtifact.buildWebhookEvent;
module.exports.buildSnsEvent = snsArtifact.buildSnsEvent;
module.exports.buildCloudwatchEvent = cloudWatchArtifact.buildCloudwatchEvent;
module.exports.buildSnsDestination = destinationArtifact.buildSnsDestination;
module.exports.buildRole = roleArtifact.buildRole;
module.exports.buildServiceAlarms = alarmArtifact.buildServiceAlarms;
module.exports.buildLambda = lambdaArtifact.buildLambda;
module.exports.buildParameters = parametersArtifact.buildParameters;
