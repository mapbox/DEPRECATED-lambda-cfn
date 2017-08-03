var cf = require('@mapbox/cloudfriend');
var assert = require('tape');
var AWS = require('aws-sdk');

var lambdaCfn = module.exports;
module.exports.build = buildFunctionTemplate; // returns full template
module.exports.embed = buildFunction; // returns only lambda resources for template merge

function stripPunc(r) {
  return r.replace(/[^A-Za-z0-9]/g,'');
}

function capitalizeFirst(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports.buildFunctionTemplate = buildFunctionTemplate;
function buildFunctionTemplate(options) {
  var template = buildFunction(options);
  template.AWSTemplateFormatVersion = '2010-09-09';
  template.Description = options.name + ' lambda-cfn function';
  return template;
}

module.exports.compileFunction = compileFunction;
function compileFunction() {
  // takes list of object and merges them into a template stub

  var template = {};
  var names = {
    Metadata: new Set(),
    Parameters: new Set(),
    Mappings: new Set(),
    Conditions: new Set(),
    Resources: new Set(),
    Outputs: new Set(),
    Variables: new Set()
  };

  if (arguments) {
    for (var arg of arguments) {
      if (arg.Metadata) {
        if (!template.Metadata) {
          template.Metadata = {};
        }
        Object.keys(arg.Metadata).forEach((key) => {
          if (names.Metadata.has(key)) {
            try { assert.equal(template.Metadata[key], arg.Metadata[key]); }
            catch (err) { throw new Error('Metadata name used more than once: ' + key); }
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
            try { assert.equal(template.Parameters[key], arg.Parameters[key]); }
            catch (err) { throw new Error('Parameters name used more than once: ' + key); }
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
            try { assert.equal(template.Mappings[key], arg.Mappings[key]); }
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
            try { assert.equal(template.Conditions[key], arg.Conditions[key]); }
            catch (err) { throw new Error('Conditions name used more than once: ' + key); }
          }

          template.Conditions[key] = arg.Conditions[key];
          names.Conditions.add(key);
        });
      }

      if (arg.Resources) {
        if (!template.Resources) {
          template.Resources = {};
        }
        Object.keys(arg.Resources).forEach((key) => {
          if (names.Resources.has(key)) {
            try { assert.equal(template.Resources[key], arg.Resources[key]); }
            catch (err) { throw new Error('Resources name used more than once: ' + key); }
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
            try { assert.equal(template.Outputs[key], arg.Outputs[key]); }
            catch (err) { throw new Error('Outputs name used more than once: ' + key); }
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
            try { assert.equal(template.Variables[key], arg.Variables[key]); }
            catch (err) { throw new Error('Variables name used more than once: ' + key); }
          }

          template.Variables[key] = arg.Variables[key];
          names.Variables.add(key);
        });
      }

      if (arg.Policies && Array.isArray(arg.Policies) && arg.Policies.length > 0) {
        if (!template.Policies) {
          template.Policies = [];
        }
        // try { assert.equal(Array.isArray(arg.Policies[0]), true); }
        // catch (err) { throw new Error('Policies are not arrays'); }
        template.Policies = template.Policies.concat(arg.Policies);
      }
    }
  }

  return template;
};

// builds an embeddable json Cloudformation template for a single function
module.exports.buildFunction = buildFunction;
function buildFunction(options) {
  if (!options.name)
    throw new Error('Function name is required');

  var parameters = buildParameters(options);
  var defaultAlarms = buildServiceAlarms(options);
  var lambda = buildLambda(options);
  var role = buildRole(options);
  var cloudwatchEvent = {};
  var schedule = {};
  var sns = {};
  var webhook = {};
  var snsDestination = {};

  // if no event source specified default to an SNS rule
  if (!options.eventSources || options.eventSources == {}) {
    sns = buildSnsEvent(options);
  }

  // only one of each event source type can be specified by a function
  if (options.eventSources) {
    for (var event in options.eventSources) {
      switch(event) {
      case 'cloudwatchEvent':
        cloudwatchEvent = buildCloudwatchEvent(options,'cloudwatchEvent');
        break;
      case 'schedule':
        schedule = buildCloudwatchEvent(options,'schedule');
        break;
      case 'sns':
        sns = buildSnsEvent(options);
        break;
      case 'webhook':
        webhook = buildWebhookEvent(options);
        break;
      default:
        throw new Error('Unknown event source specified: ' + event);
        break;
      }
    }
  }

  // defaults to SNS Destination if none specified
  if (options.destinations) {
    for (var destination in options.destinations) {
      switch(destination) {
      case 'sns':
        snsDestination = buildSnsDestination(options);
        break;
      default:
        throw new Error('Unknown destination specified: ' + destination);
        break;
      }
    }
  }

  // TODO: this should just take an array
  var functionTemplate = compileFunction(parameters,
                                         role,
                                         defaultAlarms,
                                         lambda,
                                         cloudwatchEvent,
                                         schedule,
                                         sns,
                                         webhook,
                                         snsDestination);

  // Sanity check after template compilation since
  // functions may add their own Parameter dependencies
  if (Object.keys(functionTemplate.Parameters).length > 60)
    throw new Error('More than 60 parameters specified');

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

  for (var param in functionTemplate.Parameters) {
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

module.exports.buildParameters = buildParameters;
function buildParameters(options) {
  // check for more than 60 parameters
  // check for duplicates
  // check for non-alphanumeric parameters
  var parameters = {
    Parameters: {}
  };

  if (options.parameters) {
    for (var param in options.parameters) {
      if (!(/^[a-zA-Z0-9]+$/.test(param)))
        throw new Error('Parameter names must be alphanumeric');
      if (!options.parameters[param].Type)
        throw new Error('Parameter must contain Type property');
      if (!options.parameters[param].Description)
        throw new Error('Parameter must contain Description property');
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
    Description: 'lambda function S3 prefix location'
  };

  return parameters;
}

module.exports.buildLambda = buildLambda;
function buildLambda(options) {
  var fn = {
    Resources: {}
  };

  // all function parameters available as environment variables

  fn.Resources[options.name] = {
    Type: 'AWS::Lambda::Function',
    Properties: {
      Code: {
        S3Bucket: cf.ref('CodeS3Bucket'),
        S3Key: cf.join([cf.ref('CodeS3Prefix'), cf.ref('GitSha'),'.zip'])
      },
      Role: cf.getAtt('LambdaCfnRole', 'Arn'),
      Description: cf.stackName,
      Environment: {
        Variables: {}
      },
      Handler: 'function'
    }
  };

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
  } else {
    fn.Resources[options.name].Properties.Timeout = 60;
  }

  if (options.memorySize) {
    if (options.memorySize >= 128 && options.memorySize <= 1536) {
      if ((options.memorySize % 64) == 0) {
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
  } else {
    fn.Resources[options.name].Properties.MemorySize = 128;
  }

  if (options.runtime) {
    var validRuntimes = ['nodejs4.3','nodejs6.10'];
    if (validRuntimes.indexOf(options.runtime) === -1 ) {
      throw new Error('Invalid AWS Lambda node.js runtime ' + options.runtime);
    } else {
      fn.Resources[options.name].Properties.Runtime = options.runtime;
    }
  } else {
    fn.Resources[options.name].Properties.Runtime = 'nodejs6.10';
  }

  return fn;
}

module.exports.buildCloudwatchEvent = buildCloudwatchEvent;
function buildCloudwatchEvent(options, functionType) {
  if (!functionType) throw new Error('functionType property required for cloudwatch event');
  if (!functionType.match(/cloudwatchEvent|schedule/)) throw new Error('unknown functionType property: ' + functionType);
  if (functionType == 'cloudwatchEvent' && !options.eventSources.cloudwatchEvent.eventPattern) throw new Error('eventPattern required for cloudwatch event');
  if (functionType == 'schedule' && !options.eventSources.schedule.expression) throw new Error('scheduled function expression cannot be undefined');

  var eventName = options.name + capitalizeFirst(functionType);
  var event = {
    Resources: {}
  };

  event.Resources[eventName + 'Permission'] = {
    Type: 'AWS::Lambda::Permission',
    Properties: {
      FunctionName: cf.getAtt(options.name,'Arn'),
      Action: 'lambda:InvokeFunction',
      Principal: 'events.amazonaws.com',
      SourceArn: cf.join(['arn:aws:events:', cf.region, ':', cf.accountId, ':rule/', cf.stackName, '*'])
      }
  };

  event.Resources[eventName + 'Rule'] = {
    Type: 'AWS::Events::Rule',
    Properties: {
      RoleArn: cf.getAtt('LambdaCfnRole', 'Arn'),
      State: 'ENABLED',
      Targets: [
        {
          Arn: cf.getAtt(options.name, 'Arn'),
          Id: options.name
        }
      ]
    }
  };

  if (functionType == 'cloudwatchEvent') {
    event.Resources[eventName + 'Rule'].Properties.EventPattern = options.eventSources.cloudwatchEvent.eventPattern;
  } else {
    event.Resources[eventName + 'Rule'].Properties.ScheduleExpression = options.eventSources.schedule.expression;
  }

  return event;
}

module.exports.buildWebhookEvent = buildWebhookEvent;
function buildWebhookEvent(options) {
  var webhookName = options.name + 'Webhook';
  var webhook = {
    Resources: {},
    Outputs: {}
  };

  if (!options.eventSources.webhook.method) {
    throw new Error('Webhook function method not found');
  }

  if (/GET|HEAD|PUT|PATCH|OPTIONS|POST|DELETE/.test(options.eventSources.webhook.method.toUpperCase()) == false) {
    throw new Error('Invalid client HTTP method specified: ' + options.eventSources.webhook.method);
  }

  webhook.Resources[webhookName + 'Resource'] = {
    Type: 'AWS::ApiGateway::Resource',
    Properties: {
      ParentId: cf.getAtt(webhookName + 'ApiGateway', 'RootResourceId'),
      RestApiId: cf.ref(webhookName + 'ApiGateway'),
      PathPart: options.name.toLowerCase()
    }
  };

  if (options.eventSources.webhook.method) {
    if (!options.eventSources.webhook.methodResponses) {
      options.eventSources.webhook.methodResponses = [
        {
          StatusCode: '200',
          ResponseModels: {
            'application/json': 'Empty'
          }
        },
        {
          StatusCode: '500',
          ResponseModels: {
            'application/json': 'Empty'
          }
        }
      ];
    } else if (!Array.isArray(options.eventSources.webhook.methodResponses)) {
      throw new Error('Webhook method responses is not an array');
    }
    if (!options.eventSources.webhook.integrationResponses) {
      options.eventSources.webhook.integrationResponses = [
        {
          StatusCode: '200'
        },
        {
          StatusCode: '500',
          SelectionPattern: '^(?i)(error|exception).*'
        }
      ];
    } else if (!Array.isArray(options.eventSources.webhook.integrationResponses)) {
      throw new Error('Webhook integration responses is not an array');
    }

    webhook.Resources[webhookName + 'Method'] = {
      Type: 'AWS::ApiGateway::Method',
      Properties: {
        RestApiId: cf.ref(webhookName + 'ApiGateway'),
        ResourceId: cf.ref(webhookName + 'Resource'),
        AuthorizationType: 'None',
        HttpMethod: options.eventSources.webhook.method.toUpperCase(),
        MethodResponses: options.eventSources.webhook.methodResponses,
        Integration: {
          Type: 'AWS',
          IntegrationHttpMethod: 'POST',
          IntegrationResponses: options.eventSources.webhook.integrationResponses,
          Uri: cf.join(['arn:aws:apigateway:', cf.region, ':lambda:path/2015-03-31/functions/', cf.getAtt(options.name, 'Arn'), '/invocations'])
        }
      }
    };
  }

  webhook.Resources[webhookName + 'Permission'] = {
    Type: 'AWS::Lambda::Permission',
    Properties: {
      FunctionName: cf.getAtt(options.name, 'Arn'),
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: cf.join(['arn:aws:execute-api:', cf.region, ':', cf.accountId, ':', cf.ref(webhookName + 'ApiGateway'),'/*'])
    }
  };

  webhook.Resources[webhookName + 'ApiGateway'] = {
      Type: 'AWS::ApiGateway::RestApi',
      Properties: {
        Name: cf.stackName,
        FailOnWarnings: 'true'
      }
  };

  // randomizes deployment name so that code can be redeployed over an existing stage
  var apiDeploymentRandom;
  if (process.env.NODE_ENV == 'test') {
    apiDeploymentRandom = 'ApiDeployment';
  } else {
    apiDeploymentRandom = 'ApiDeployment' + Math.random().toString(36).slice(2);
  }

  webhook.Resources[webhookName + 'ApiKey'] = {
    Type: 'AWS::ApiGateway::ApiKey',
    DependsOn: webhookName + apiDeploymentRandom,
    Properties: {
      Name: cf.stackName,
      Enabled: 'true',
      StageKeys: [
        {
          RestApiId: cf.ref(webhookName + 'ApiGateway'),
          StageName: 'prod'
        }
      ]
    }
  };

  webhook.Resources[webhookName + apiDeploymentRandom] = {
    Type: 'AWS::ApiGateway::Deployment',
    DependsOn: webhookName + 'Method',
    Properties: {
      RestApiId: cf.ref(webhookName + 'ApiGateway'),
      StageName: 'prod'
    }
  };

  webhook.Resources[webhookName + 'ApiLatencyAlarm'] = {
    Type: 'AWS::CloudWatch::Alarm',
    Properties: {
      EvaluationPeriods: '5',
      Statistic: 'Sum',
      Threshold: '4',
      AlarmDescription: 'https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#ApiLatencyAlarm',
      Period: '60',
      AlarmActions: [ cf.ref('ServiceAlarmSNSTopic') ],
      Namespace: 'AWS/ApiGateway',
      Dimensions: [
        {
          Name: 'APIName',
          Value: cf.stackName
        }
      ],
      ComparisonOperator: 'GreaterThanThreshold',
      MetricName: 'Latency'
    }
  };

  webhook.Resources[webhookName + 'Api4xxAlarm'] = {
    Type: 'AWS::CloudWatch::Alarm',
    Properties: {
      EvaluationPeriods: '5',
      Statistic: 'Sum',
      Threshold: '100',
      AlarmDescription: 'https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#Api4xxAlarm',
      Period: '60',
      AlarmActions: [ cf.ref('ServiceAlarmSNSTopic') ],
      Namespace: 'AWS/ApiGateway',
      Dimensions: [
        {
          Name: 'APIName',
          Value: cf.stackName
        }
      ],
      ComparisonOperator: 'GreaterThanThreshold',
      MetricName: '4xxError'
    }
  };

  webhook.Resources[webhookName + 'ApiCountAlarm'] = {
    Type: 'AWS::CloudWatch::Alarm',
    Properties: {
      EvaluationPeriods: '5',
      Statistic: 'Sum',
      Threshold: '10000',
      AlarmDescription: 'https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#ApiCountAlarm',
      Period: '60',
      AlarmActions: [ cf.ref('ServiceAlarmSNSTopic') ],
      Namespace: 'AWS/ApiGateway',
      Dimensions: [
        {
          Name: 'APIName',
          Value: cf.stackName
        }
      ],
      ComparisonOperator: 'GreaterThanThreshold',
      MetricName: 'Count'
    }
  };

  webhook.Resources[webhookName + 'Permission'] = {
    Type: 'AWS::Lambda::Permission',
    Properties: {
      FunctionName: cf.getAtt(options.name, 'Arn'),
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: cf.join(['arn:aws:execute-api:', cf.region, ':', cf.accountId, ':', cf.ref(webhookName + 'ApiGateway'), '/*'])
    }
  };

  webhook.Outputs[webhookName + 'APIEndpoint'] = {
    Value: cf.join(['https://', cf.ref(webhookName + 'ApiGateway'), '.execute-api.', cf.region, '.amazonaws.com/prod/', options.name.toLowerCase()])
  };

  if (options.eventSources.webhook.apiKey) {
    webhook.Resources[webhookName + 'Method'].Properties.ApiKeyRequired = 'true';
    webhook.Outputs[webhookName + 'ApiKey'] = cf.ref(webhookName + 'ApiKey');
  }

  return webhook;
}

module.exports.buildSnsEvent = buildSnsEvent;
function buildSnsEvent(options) {
  var snsEvent = {
    Resources: {},
    Outputs: {}
  };

  snsEvent.Resources[options.name + 'SNSPermission'] = {
    Type: 'AWS::Lambda::Permission',
    Properties: {
      FunctionName: cf.getAtt(options.name, 'Arn'),
      Action: 'lambda:InvokeFunction',
      Principal: 'sns.amazonaws.com',
      SourceArn: cf.ref(options.name + 'SNSTopic')
    }
  };

  snsEvent.Resources[options.name + 'SNSUser'] = {
    Type: 'AWS::IAM::User',
    Properties: {
      Policies: [
        {
          PolicyName: options.name + 'SNSTopicPolicy',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Resource: cf.ref(options.name + 'SNSTopic'),
                Action: [
                  'sns:ListTopics',
                  'sns:Publish',
                ],
                Effect: 'Allow'
              },
              // required permissions for Zapier SNS integrations
              {
                Resource: cf.join(['arn:aws:sns:', cf.region, ':', cf.accountId, ':*']),
                Action: [
                  'sns:ListTopics',
                ],
                Effect: 'Allow'
              }
            ]
          }
        }
      ]
    }
  };

  snsEvent.Resources[options.name + 'SNSTopic'] = {
    Type: 'AWS::SNS::Topic',
    Properties: {
      DisplayName: cf.join('-', [cf.stackName, options.name]),
      TopicName: cf.join('-', [cf.stackName, options.name]),
      Subscription: [
        {
          Endpoint: cf.getAtt(options.name, 'Arn'),
          Protocol: 'lambda'
        }
      ]
    }
  };

  snsEvent.Resources[options.name + 'SNSUserAccessKey'] = {
    Type: 'AWS::IAM::AccessKey',
    Properties: {
      UserName: cf.ref(options.name + 'SNSUser')
    }
  };

  snsEvent.Outputs[options.name + 'SNSTopic'] = {
    Value: cf.ref(options.name + 'SNSTopic')
  };
  snsEvent.Outputs[options.name + 'SNSUserAccessKey'] = {
    Value: cf.ref(options.name + 'SNSUserAccessKey')
  };
  snsEvent.Outputs[options.name + 'SNSUserSecretAccessKey'] = {
    Value: cf.getAtt(options.name + 'SNSUserAccessKey', 'SecretAccessKey')
  };

  return snsEvent;
}

module.exports.buildRole = buildRole;
function buildRole(options) {
  var role = {
    Resources: {}
  };

  role.Resources['LambdaCfnRole'] = {
    Type: 'AWS::IAM::Role',
    Properties: {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Sid: '',
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          },
          {
            Sid: '',
            Effect: 'Allow',
            Principal: {
              Service: 'events.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      },
      Path: '/',
      Policies: [
        {
          PolicyName: 'basic',
          PolicyDocument: {
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'logs:FilterLogEvents',
                  'logs:GetLogEvents'
                ],
                Resource: cf.join(['arn:aws:logs:*:', cf.accountId, ':*'])
              },
              {
                Effect: 'Allow',
                Action: [
                  'sns:Publish'
                ],
                Resource: cf.ref('ServiceAlarmSNSTopic')
              },
              {
                Effect: 'Allow',
                Action: [
                  'iam:SimulateCustomPolicy'
                ],
                Resource: '*'
              }
            ]
          }
        }
      ]
    }
  };

  if (options.eventSources && options.eventSources.webhook) {
    role.Resources['LambdaCfnRole'].Properties.AssumeRolePolicyDocument.Statement.push({
    Sid: '',
      Effect: 'Allow',
      Principal: {
        Service: 'apigateway.amazonaws.com'
      },
      Action: 'sts:AssumeRole'
    });
  }

  if (options.statements && !Array.isArray(options.statements))
    throw new Error('options.statements must be an array');
  if (options.statements) {
    // Very basic validation on each policy statement
    options.statements.forEach(function(statement) {
      if (!statement.Effect)
        throw new Error('statement must contain Effect');
      if (!statement.Resource && !statement.NotResource)
        throw new Error('statement must contain Resource or NotResource');
      if (!statement.Action && !statement.NotAction)
        throw new Error('statement must contain Action or NotAction');
    });
    role.Resources['LambdaCfnRole'].Properties.Policies.push({
      PolicyName: options.name,
      PolicyDocument: {
        Statement: options.statements
      }
    });
  };

  return role;
}

module.exports.buildServiceAlarms = buildServiceAlarms;
function buildServiceAlarms(options) {
  var alarms = {
    Parameters: {},
    Resources: {},
    Variables: {}
  };

  var defaultAlarms = [
    {
      AlarmName: 'Errors',
      MetricName: 'Errors',
      ComparisonOperator: 'GreaterThanThreshold'
    },
    {
      AlarmName: 'NoInvocations',
      MetricName: 'Invocations',
      ComparisonOperator: 'LessThanThreshold'
    }
  ];

  defaultAlarms.forEach(function(alarm) {
    alarms.Resources[options.name + 'Alarm' + alarm.AlarmName] = {
      Type: 'AWS::CloudWatch::Alarm',
      Properties: {
        EvaluationPeriods: '5',
        Statistic: 'Sum',
        Threshold: '0',
        AlarmDescription: 'https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#' + alarm.AlarmName,
        Period: '60',
        AlarmActions: [ cf.ref('ServiceAlarmSNSTopic') ],
        Namespace: 'AWS/Lambda',
        Dimensions: [
          {
            Name: 'FunctionName',
            Value: cf.ref(options.name)
          }
        ],
        ComparisonOperator: alarm.ComparisonOperator,
        MetricName: alarm.MetricName
      }
    };
  });

  alarms.Parameters = {
    ServiceAlarmEmail:{
      Type: 'String',
      Description: 'Service alarm notifications will send to this email address'
    }
  };

  alarms.Resources.ServiceAlarmSNSTopic = {
    Type: 'AWS::SNS::Topic',
    Properties: {
      TopicName: cf.join('-', [cf.stackName, 'ServiceAlarm']),
      Subscription: [
        {
          Endpoint: cf.ref('ServiceAlarmEmail'),
          Protocol: 'email'
        }
      ]
    }
  };

  alarms.Variables.ServiceAlarmSNSTopic = cf.ref('ServiceAlarmSNSTopic');
  return alarms;
}

module.exports.buildSnsDestination = buildSnsDestination;
function buildSnsDestination(options) {
  // TODO: this entire function needs to more generic
  var sns = {
    Resources: {},
    Parameters: {},
    Variables: {},
    Policies: []
  };

  // for porting existing lambda-cfn code over, if an SNS destination
  // is defaulted, then use the ServiceAlarmEmail, else create a new Topic
  if (options.destinations && options.destinations.sns) {
    sns.Parameters['ApplicationAlarmEmail'] = {
      Type: 'String',
      Description: 'Application SNS notifications will send to this email address'
    };

    // TODO: better way to manage built in required permissions

    sns.Policies.push({
      PolicyName: options.name + 'SNSDestinationPermissions',
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

    sns.Resources[options.name + 'SNSDestination'] = {
      Type: 'AWS::SNS::Topic',
      Properties: {
        TopicName: cf.join('-', [cf.stackName, 'ApplicationAlarm']),
        Subscription: [
          {
            Endpoint: cf.ref('ApplicationAlarmEmail'),
            Protocol: 'email'
          }
        ]
      }
    };
    sns.Variables.ApplicationAlarmSNSTopic = cf.ref(options.name + 'SNSDestination');
  }

  return sns;
}


// Utility and convenience functions
module.exports.splitOnComma = splitOnComma;
function splitOnComma(str) {
  if (str) {
    return str.split(/\s*,\s*/);
  } else {
    // splitting unset parameter shouldn't return a non-falsey value
    return '';
  }
};

module.exports.message = message;
function message(msg, callback) {
  if (process.env.NODE_ENV == 'test') {
    callback(null, msg);
  } else {
    var sns = new AWS.SNS();
    var params = {
      Subject: msg.subject,
      Message:
      msg.summary + "\n\n" +
        JSON.stringify(msg.event, null, 2),
      TopicArn: (process.env.ApplicationAlarmSNSTopic ? process.env.ApplicationAlarmSNSTopic : process.env.ServiceAlarmSNSTopic)
    };
    sns.publish(params, function(err, data) {
      callback(err, data);
    });
  }
};
