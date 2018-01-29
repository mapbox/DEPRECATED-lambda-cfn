const cf = require('@mapbox/cloudfriend');
const webhooks = require('./events/webhook');
const snsEvent = require('./events/sns');
const cloudWatchEvent = require('./events/cloudwatch');
const roles = require('./resources/roles');
const alarms = require('./resources/alarms');
const dispatchResource = require('./resources/dispatch');
const lambdaResource = require('./resources/lambda');
const cloudfrontParameters = require('./parameters');

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

  let parameters = cloudfrontParameters.buildParameters(options);
  let defaultAlarms = alarms.buildServiceAlarms(options);
  let lambda = lambdaResource.buildLambda(options);
  let role = roles.buildRole(options);
  let cloudwatchEvent = {};
  let schedule = {};
  let sns = {};
  let webhook = {};
  let snsDestination = {};

  // if no event source specified default to an SNS rule
  if (!options.eventSources || options.eventSources === {}) {
    sns = snsEvent.buildSnsEvent(options);
  }

  // only one of each event source type can be specified by a function
  if (options.eventSources) {
    for (let event in options.eventSources) {
      switch(event) {
        case 'cloudwatchEvent':
          cloudwatchEvent = cloudWatchEvent.buildCloudwatchEvent(options, 'cloudwatchEvent');
          break;
        case 'schedule':
          schedule = cloudWatchEvent.buildCloudwatchEvent(options, 'schedule');
          break;
        case 'sns':
          sns = snsEvent.buildSnsEvent(options);
          break;
        case 'webhook':
          webhook = webhooks.buildWebhookEvent(options);
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
          snsDestination = buildSnsDestination(options);
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

  dispatchResource.addDispatchSupport(functionTemplate, options);

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
    functionTemplate.Resources.LambdaCfnRole.Properties.Policies.push(functionTemplate.Policies);
    functionTemplate.Resources.LambdaCfnDispatchRole.Properties.Policies.push(functionTemplate.Policies);
    delete functionTemplate.Policies;
  }

  return functionTemplate;
}

/* eslint-disable no-loop-func */
function compileFunction() {
  // takes list of object and merges them into a template stub

  let template = {};

  if (arguments) {
    for (let arg of arguments) {
      populateTemplate(template, arg, 'Metadata');
      populateTemplate(template, arg, 'Parameters');
      populateTemplate(template, arg, 'Mappings');
      populateTemplate(template, arg, 'Conditions');
      populateTemplate(template, arg, 'Resources');
      populateTemplate(template, arg, 'Outputs');
      populateTemplate(template, arg, 'Variables');
      if (arg.Policies && Array.isArray(arg.Policies) && arg.Policies.length > 0) {
        if (!template.Policies) {
          template.Policies = [];
        }
        template.Policies = template.Policies.concat(arg.Policies);
      }
    }
  }

  return template;
}

function populateTemplate(template, arg, propertyName) {
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

function buildSnsDestination(options) {

  let sns = {
    Resources: {},
    Parameters: {},
    Variables: {},
    Policies: []
  };

  // for porting existing lambda-cfn code over, if an SNS destination
  // is defaulted, then use the ServiceAlarmEmail, else create a new Topic

  if (options.destinations && options.destinations.sns) {
    for (let destination in options.destinations.sns) {
      sns.Parameters[destination + 'Email'] = {
        Type: 'String',
        Description:  options.destinations.sns[destination].Description
      };
      sns.Policies.push({
        PolicyName: destination + 'TopicPermissions',
        PolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Action: 'sns:Publish',
              Resource: cf.ref(options.name)
            }
          ]
        }
      });

      sns.Resources[destination + 'Topic'] = {
        Type: 'AWS::SNS::Topic',
        Properties: {
          TopicName: cf.join('-', [cf.stackName, destination]),
          Subscription: [
            {
              Endpoint: cf.ref(destination + 'Email'),
              Protocol: 'email'
            }
          ]
        }
      };

      sns.Variables[destination + 'Topic'] = cf.ref(destination + 'Topic');
    }
    return sns;
  }
}

module.exports = buildFunctionTemplate; // returns full template
module.exports.embed = buildFunction; // returns only lambda resources for template merge
module.exports.buildWebhookEvent = webhooks.buildWebhookEvent;
module.exports.buildSnsEvent = snsEvent.buildSnsEvent;
module.exports.buildCloudwatchEvent = cloudWatchEvent.buildCloudwatchEvent;
module.exports.buildSnsDestination = buildSnsDestination;
module.exports.buildRole = roles.buildRole;
module.exports.buildServiceAlarms = alarms.buildServiceAlarms;
module.exports.buildLambda = lambdaResource.buildLambda;
module.exports.buildParameters = cloudfrontParameters.buildParameters;
module.exports.buildFunction = buildFunction;
module.exports.compileFunction = compileFunction;
module.exports.buildFunctionTemplate = buildFunctionTemplate;
