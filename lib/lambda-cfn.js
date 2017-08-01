// var path = require('path');
//var fs = require('fs');
var cf = require('@mapbox/cloudfriend');
// var AWS = require('aws-sdk');
// var root = process.env.LAMBDA_TASK_ROOT ?
//       process.env.LAMBDA_TASK_ROOT :
//       require('app-root-path').path;



// exported for testing
// var pkgs;
// if (process.env.NODE_ENV == 'test') {
//   pkgs = require(path.join(root,'test/package.json'));
// } else {
//   pkgs = require(path.join(root,'package.json'));
// }

var lambdaCfn = module.exports;
module.exports.build = buildFunctionTemplate; // returns full template
module.exports.embed = buildFunction; // returns only lambda resources for template merge

function stripPunc(r) {
  return r.replace(/[^A-Za-z0-9]/g,'');
}

function capitalizeFirst(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildFunctionTemplate(options) {
  var template = buildFunction(options);
  template.AWSTemplateFormatVersion = '2010-09-09';
  template.Description = options.name + ' lambda-cfn function';
  return template;
}

function compileFunction() {
  // takes list of object and merges them into a template stub

  var template = {};
  var names = {
    Metadata: new Set(),
    Parameters: new Set(),
    Mappings: new Set(),
    Conditions: new Set(),
    Resources: new Set(),
    Outputs: new Set()
  };

  if (arguments) {
    for (var arg of arguments) {
      if (arg.Metadata) {
        if (!template.Metadata) {
          template.Metadata = {};
        }
        Object.keys(arg.Metadata).forEach((key) => {
          if (names.Metadata.has(key)) {
            try { assert.deepEqual(template.Metadata[key], arg.Metadata[key]); }
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
            try { assert.deepEqual(template.Parameters[key], arg.Parameters[key]); }
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
            try { assert.deepEqual(template.Mappings[key], arg.Mappings[key]); }
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
            try { assert.deepEqual(template.Conditions[key], arg.Conditions[key]); }
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
            try { assert.deepEqual(template.Resources[key], arg.Resources[key]); }
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
            try { assert.deepEqual(template.Outputs[key], arg.Outputs[key]); }
            catch (err) { throw new Error('Outputs name used more than once: ' + key); }
          }

          template.Outputs[key] = arg.Outputs[key];
          names.Outputs.add(key);
        });
      }
    }
  }

  return template;
};

// builds an embeddable json Cloudformation template for a single function
function buildFunction(options) {

  var parameters = buildParameters(options);
  var defaultAlarms = buildCloudwatchDefaultAlarms(options);
  var lambda = buildLambda(options);
  var role = buildRole(options);
  var alarmTopic = buildAlarmSnsTopic(options);
  var cloudwatchEvent = {};
  var schedule = {};
  var sns = {};
  var webhook = {};
  var snsDestination = {};

  // if no event source specified default to an SNS rule
  if (!options.eventSources) {
    sns = buildSnsEvent(options);
  }

  // only one of each event source type can be specified by a function
  for (var event in options.eventSources) {
    switch(event) {
    case 'cloudwatch':
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
      sns = buildSnsEvent(options);
      break;
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
        snsDestination = buildSnsDestination(options);
        break;
      }
    }
  }

  var functionTemplate = compileFunction(parameters,
                                         defaultAlarms,
                                         lambda,
                                         role,
                                         cloudwatchEvent,
                                         schedule,
                                         sns,
                                         webhook,
                                         alarmTopic,
                                         snsDestination);


  // since build functions may create their own parameters outside of
  // the buildParameters step, this is called after all functions
  // have been run, gathers all parameters and injects them into the lambda
  // environment configuration
  var params = {};
  // make some global env vars available
  params.StackName = cf.stackName;
  params.Region = cf.region;
  params.AccountId = cf.accountId;
  params.StackId = cf.stackId;

  for (var param in functionTemplate.Parameters) {
    params[param] = cf.ref(param);

  }

  functionTemplate.Resources[options.name].Properties.Environment.Variables = params;
  return functionTemplate;
}


function buildParameters(options) {
  // check for more than 60 parameters
  // check for duplicates
  // check for non-alphanumeric parameters
  var parameters = {
    Parameters: {}
  };

  if (options.parameters) {
    for (var param in options.parameters) {
      if (!param.match(/[a-zA-Z0-9]+/))
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

  if (parameters.length > 60)
    throw new Error('More than 60 parameters specified');

  return parameters;
}

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
      Handler: 'function',
      Runtime: (options.runtime ? options.runtime : 'node6.10')
    }
  };

  if (options.timeout) {
    if (options.timeout <= 300) {
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
        // round down to near 64MB increment
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

function buildCloudwatchEvent(options, ruleType) {
  if (!options.name) throw new Error('name property required for cloudwatch event');
  if (!ruleType) throw new Error('ruleType property required for cloudwatch event');
  if (!ruleType.match(/cloudwatchEvent|schedule/)) throw new Error('unknown ruleType property: ' + ruleType);
  if (ruleType == 'cloudwatchEvent' && !options.eventSources.cloudwatchEvent.eventPattern) throw new Error('eventPattern required for cloudwatch event');
  if (ruleType == 'schedule' && !options.eventSources.schedule.expression) throw new Error('scheduled rule expression cannot be undefined');

  var eventName = options.name + capitalizeFirst(ruleType);
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

  event.Resources[eventName] = {
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

  if (ruleType == 'cloudwatchEvent') {
    event.Resources[eventName].Properties.EventPattern = options.eventSources.cloudwatchEvent.eventPattern;
  } else {
    event.Resources[eventName].Properties.ScheduleExpression = options.eventSources.schedule.expression;
  }

  return event;
}

function buildWebhookEvent(options) {
  var webhookName = options.name + 'Webhook';
  var webhook = {
    Resources: {},
    Outputs: {}
  };

  if (/GET|HEAD|PUT|PATCH|OPTIONS|POST|DELETE/.test(options.eventSources.webhook.method.toUpperCase()) == false) {
    throw new Error('Invalid client HTTP method specified: ' + options.eventSources.webhook.method);
  }

  if (options.eventSources.webhook.resource) {
    webhook.Resources[webhookName + 'Resource'] = {
        Type: 'AWS::ApiGateway::Resource',
        Properties: {
          ParentId: cf.getAtt(webhookName + 'ApiGateway', 'RootResourceId'),
          RestApiId: cf.ref(webhookName + 'ApiGateway'),
          PathPart: options.name.toLowerCase()
        }
      };
    }

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

  webhook.Resources[webhookName + 'ApiKey'] = {
    Type: 'AWS::ApiGateway::ApiKey',
    DependsOn: apiDeploymentRandom,
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

  webhook.Resources[webhookName + 'Permission'] = {
    Type: 'AWS::Lambda::Permission',
    Properties: {
      FunctionName: cf.getAtt(options.name, 'Arn'),
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: cf.join(['arn:aws:execute-api:', cf.region, ':', cf.accountId, ':', cf.ref('ApiGateway'),'/*'])
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

  webhook.Resources[webhookName + apiDeploymentRandom] = {
    Type: 'AWS::ApiGateway::Deployment',
    DependsOn: cf.ref(webhookName + 'Method'),
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
      AlarmActions: cf.ref('LambdaCfnAlarmSNSTopic'),
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
      AlarmActions: cf.ref('LambdaCfnAlarmSNSTopic'),
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
      AlarmActions: cf.ref('LambdaCfnAlarmSNSTopic'),
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
      SourceArn: cf.join(['arn:aws:execute-api:', cf.region, ':', cf.accountId, ':', cf.ref('ApiGateway'), '/*'])
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
                Resource: cf.ref('LambdaCfnAlarmSNSTopic')
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
  };

  role.Resources['LambdaCfnRole'].Properties.Policies.push({
    PolicyName: options.name,
    PolicyDocument: {
      Statement: options.statements
    }
  });

  return role;
}


function buildCloudwatchDefaultAlarms(options) {
  var alarms = {
    Resources: {}
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
        AlarmActions: cf.ref('LambdaCfnAlarmSNSTopic'),
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

  return alarms;
}

function buildAlarmSnsTopic(options) {
  return {
    Parameters: {
      AlarmEmail:{
        Type: 'String',
        Description: 'Service alarm notifications will send to this email address'
      }
    },
    Resources: {
      LambdaCfnAlarmSNSTopic:{
        Type: 'AWS::SNS::Topic',
        Properties: {
          TopicName: cf.stackName,
          Subscription: [
            {
              Endpoint: cf.ref('AlarmEmail'),
              Protocol: 'email'
            }
          ]
        }
      }
    }
  };
}

function buildSnsDestination(options) {
  var sns = {
    Resources: {},
    Parameters: {}
  };
  sns.Parameters['SNSDestination'] = {
    AlarmEmail:{
      Type: 'String',
      Description: 'Application SNS notifications will send to this email address'
    }
  };
  sns.Resources[options.name + 'SNSDestination'] = {
    Type: 'AWS::SNS::Topic',
    Properties: {
      TopicName: cf.stackName,
      Subscription: [
        {
          Endpoint: cf.ref('AlarmEmail'),
          Protocol: 'email'
        }
      ]
    }
  };

  return sns;
}
