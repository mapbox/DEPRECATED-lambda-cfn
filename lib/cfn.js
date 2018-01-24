const path = require('path');
const cf = require('@mapbox/cloudfriend');
const webhooks = require('./events/webhook');
const snsEvent = require('./events/sns');
const cloudWatchEvent = require('./events/cloudwatch');
const roles = require('./resources/roles');
const alarms = require('./resources/alarms');
const dispatch = require('./resources/dispatch');

const DEFAULT_LAMBDA_SETTINGS = {
  RUNTIME: 'nodejs6.10',
  MEMORY_SIZE: 128,
  TIMEOUT: 60
};

function buildFunctionTemplate(options) {
  let template = buildFunction(options);
  template.AWSTemplateFormatVersion = '2010-09-09';
  template.Description = options.name + ' lambda-cfn function';
  return template;
}

// builds an embeddable json Cloudformation template for a single function
function buildFunction(options) {
  if (!options.name) {
    throw new Error('Function name is required');
  }

  let parameters = buildParameters(options);
  let defaultAlarms = alarms.buildServiceAlarms(options);
  let lambda = buildLambda(options);
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
          throw new Error('Unknown event source specified: ' + event);
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
          throw new Error('Unknown destination specified: ' + destination);
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

  dispatch.addDispatchSupport(functionTemplate, options);

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

  functionTemplate.Resources[options.name].Properties.Environment.Variables = functionTemplate.Variables;
  // Variables object is not valid CFN
  delete functionTemplate.Variables;

  // compile any additional built-in policy objects into role
  if (functionTemplate.Policies) {
    functionTemplate.Resources.LambdaCfnRole.Properties.Policies.push(functionTemplate.Policies);
    delete functionTemplate.Policies;
  }

  return functionTemplate;
}

/* eslint-disable no-loop-func */
function compileFunction() {
  // takes list of object and merges them into a template stub

  let template = {};
  let names = {
    Metadata: new Set(),
    Parameters: new Set(),
    Mappings: new Set(),
    Conditions: new Set(),
    Resources: new Set(),
    Outputs: new Set(),
    Variables: new Set()
  };

  if (arguments) {
    for (let arg of arguments) {
      if (arg.Metadata) {
        if (!template.Metadata) {
          template.Metadata = {};
        }
        Object.keys(arg.Metadata).forEach((key) => {
          if (names.Metadata.has(key)) {
            try {
              assert.equal(template.Metadata[key], arg.Metadata[key]);
            }
            catch (err) {
              throw new Error('Metadata name used more than once: ' + key);
            }
          }

          template.Metadata[key] = arg.Metadata[key];
          names.Metadata.add(key);
        });
      }

      if (arg.Parameters) {
        if (!template.Parameters) {
          template.Parameters = {};
        }
        Object.keys(arg.Parameters).forEach((key) => {
          if (names.Parameters.has(key)) {
            try {
              assert.equal(template.Parameters[key], arg.Parameters[key]);
            }
            catch (err) {
              throw new Error('Parameters name used more than once: ' + key);
            }
          }

          template.Parameters[key] = arg.Parameters[key];
          names.Parameters.add(key);
        });
      }

      if (arg.Mappings) {
        if (!template.Mappings) {
          template.Mappings = {};
        }
        Object.keys(arg.Mappings).forEach((key) => {
          if (names.Mappings.has(key)) {
            try {
              assert.equal(template.Mappings[key], arg.Mappings[key]);
            }
            catch (err) { throw new Error('Mappings name used more than once: ' + key); }
          }

          template.Mappings[key] = arg.Mappings[key];
          names.Mappings.add(key);
        });
      }

      if (arg.Conditions) {
        if (!template.Conditions) {
          template.Conditions = {};
        }

        Object.keys(arg.Conditions).forEach((key) => {
          if (names.Conditions.has(key)) {
            try {
              assert.equal(template.Conditions[key], arg.Conditions[key]);
            }
            catch (err) {
              throw new Error('Conditions name used more than once: ' + key);
            }
          }

          template.Conditions[key] = arg.Conditions[key];
        });
      }

      if (arg.Resources) {
        if (!template.Resources) {
          template.Resources = {};
        }
        Object.keys(arg.Resources).forEach((key) => {
          if (names.Resources.has(key)) {
            try {
              assert.equal(template.Resources[key], arg.Resources[key]);
            }
            catch (err) {
              throw new Error('Resources name used more than once: ' + key);
            }
          }

          template.Resources[key] = arg.Resources[key];
          names.Resources.add(key);
        });
      }

      if (arg.Outputs) {
        if (!template.Outputs) {
          template.Outputs = {};
        }
        Object.keys(arg.Outputs).forEach((key) => {
          if (names.Outputs.has(key)) {
            try {
              assert.equal(template.Outputs[key], arg.Outputs[key]);
            }
            catch (err) {
              throw new Error('Outputs name used more than once: ' + key);
            }
          }

          template.Outputs[key] = arg.Outputs[key];
          names.Outputs.add(key);
        });
      }

      if (arg.Variables) {
        if (!template.Variables) {
          template.Variables = {};
        }
        Object.keys(arg.Variables).forEach((key) => {
          if (names.Variables.has(key)) {
            try {
              assert.equal(template.Variables[key], arg.Variables[key]);
            }
            catch (err) {
              throw new Error('Variables name used more than once: ' + key);
            }
          }

          template.Variables[key] = arg.Variables[key];
          names.Variables.add(key);
        });
      }

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

/* eslint-enable no-loop-func */
function buildParameters(options) {
  let parameters = {
    Parameters: {}
  };

  if (options.parameters) {
    for (let param in options.parameters) {
      if (!(/^[a-zA-Z0-9]+$/.test(param))) {
        throw new Error('Parameter names must be alphanumeric');
      }

      if (!options.parameters[param].Type) {
        throw new Error('Parameter must contain Type property');
      }

      if (!options.parameters[param].Description) {
        throw new Error('Parameter must contain Description property');
      }
    }
    parameters.Parameters = options.parameters;
  }

  parameters.Parameters.CodeS3Bucket = {
    Type: 'String',
    Description: 'lambda function S3 bucket location'
  };
  parameters.Parameters.CodeS3Prefix = {
    Type: 'String',
    Description: 'lambda function S3 prefix location'
  };
  parameters.Parameters.GitSha = {
    Type: 'String',
    Description: 'Deploy Gitsha'
  };

  return parameters;
}

function buildLambda(options) {
  // crawl the module path to make sure the Lambda handler path is
  // set correctly: <functionDir>/function.fn
  let handlerPath = (module.parent.parent.filename).split(path.sep).slice(-2).shift();
  let fn = {
    Resources: {}
  };

  // all function parameters available as environment variables
  fn.Resources[options.name] = {
    Type: 'AWS::Lambda::Function',
    Properties: {
      Code: {
        S3Bucket: cf.ref('CodeS3Bucket'),
        S3Key: cf.join([cf.ref('CodeS3Prefix'), cf.ref('GitSha'), '.zip'])
      },
      Role: cf.if('HasDispatchSnsArn', cf.getAtt('LambdaCfnRole', 'Arn'), cf.getAtt('LambdaCfnDispatchRole', 'Arn')),
      Description: cf.stackName,
      Environment: {
        Variables: {}
      },
      Handler: handlerPath + '/function.fn'
    }
  };

  fn.Resources[options.name].Properties.Timeout = DEFAULT_LAMBDA_SETTINGS.TIMEOUT;
  if (options.timeout) {
    if (options.timeout <= 300 && options.timeout > 0) {
      fn.Resources[options.name].Properties.Timeout = options.timeout;
    } else {
      if (options.timeout > 300) {
        fn.Resources[options.name].Properties.Timeout = 300;
      } else {
        fn.Resources[options.name].Properties.Timeout = 60;
      }
    }
  }

  fn.Resources[options.name].Properties.MemorySize = DEFAULT_LAMBDA_SETTINGS.MEMORY_SIZE;
  if (options.memorySize) {
    if (options.memorySize >= 128 && options.memorySize <= 1536) {
      if ((options.memorySize % 64) === 0) {
        fn.Resources[options.name].Properties.MemorySize = options.memorySize;
      } else {
        // round down to nearest 64MB increment
        fn.Resources[options.name].Properties.MemorySize = options.memorySize - (options.memorySize % 64);
      }
    } else if (options.memorySize < 128) {
      fn.Resources[options.name].Properties.MemorySize = 128;
    } else {
      fn.Resources[options.name].Properties.MemorySize = 1536;
    }
  }

  fn.Resources[options.name].Properties.Runtime = DEFAULT_LAMBDA_SETTINGS.RUNTIME;
  if (options.runtime) {
    let validRuntimes = ['nodejs4.3', 'nodejs6.10'];
    if (validRuntimes.indexOf(options.runtime) === -1) {
      throw new Error('Invalid AWS Lambda node.js runtime ' + options.runtime);
    } else {
      fn.Resources[options.name].Properties.Runtime = options.runtime;
    }
  }

  return fn;
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
module.exports.buildLambda = buildLambda;
module.exports.buildParameters = buildParameters;
module.exports.buildFunction = buildFunction;
module.exports.compileFunction = compileFunction;
module.exports.buildFunctionTemplate = buildFunctionTemplate;
