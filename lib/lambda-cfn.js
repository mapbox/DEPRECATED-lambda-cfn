var path = require('path');
var fs = require('fs');
var streambot = require('streambot');
var AWS = require('aws-sdk');
var root = process.env.LAMBDA_TASK_ROOT ?
      process.env.LAMBDA_TASK_ROOT :
      require('app-root-path').path;
var apiDeploymentRandom;

if (process.env.NODE_ENV == 'test') {
  apiDeploymentRandom = 'ApiDeployment';
} else {
  apiDeploymentRandom = 'ApiDeployment' + Math.random().toString(36).slice(2);
}

var lambdaCfn = module.exports = embed;
module.exports.build = build;
lambdaCfn.compile = compile;
lambdaCfn.parameters = parameters;
lambdaCfn.lambda = lambda;
lambdaCfn.lambdaPermission = lambdaPermission;
lambdaCfn.role = role;
lambdaCfn.policy = policy;
lambdaCfn.streambotEnv = streambotEnv;
lambdaCfn.cloudwatch = cloudwatch;
lambdaCfn.snsTopic = snsTopic;
lambdaCfn.message = message;
lambdaCfn.splitOnComma = splitOnComma;
lambdaCfn.lambdaSnsTopic = lambdaSnsTopic;
lambdaCfn.lambdaSnsUser = lambdaSnsUser;
lambdaCfn.lambdaSnsUserAccessKey = lambdaSnsUserAccessKey;
lambdaCfn.outputs = outputs;
lambdaCfn.load = load;
lambdaCfn.getEnv = getEnv;
lambdaCfn.cweRules = cweRules;
lambdaCfn.apiGateway = apiGateway;
lambdaCfn.apiDeployment = apiDeployment;
lambdaCfn.apiKey = apiKey;
lambdaCfn.gatewayRules = gatewayRules;

function stripPunc(r) {
  return r.replace(/[^A-Za-z0-9]/g,'');
}

// exported for testing
var pkgs;
if (process.env.NODE_ENV == 'test') {
  pkgs = require(path.join(root,'test/package.json'));
} else {
  pkgs = require(path.join(root,'package.json'));
}

function namespace(name,path) {
  var namePrefix;
  for (var pkg in pkgs.dependencies) {
    if (path.match(pkg)) {
      namePrefix = stripPunc(pkg);
      break;
    }
  }

  if (namePrefix) {
    return (namePrefix + name);
  } else {
    return name;
  }
}

function load(m, templateFilePath) {
  // Configurable for the sake of testing
  var templateFile;
  if (templateFilePath && templateFilePath !== true) {
    templateFile = templateFilePath;
  } else {
    var files = fs.readdirSync(path.join(root, 'cloudformation'));
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (path.extname(file) == '.js' && file.indexOf('.template.') > -1) {
        templateFile = path.join(root, 'cloudformation', file);
        break;
      }
    }
  }

  var template = require(templateFile);
  for (var r in template.Resources) {
    if (template.Resources[r].Type == 'AWS::Lambda::Function' &&
        template.Resources[r].Metadata &&
        template.Resources[r].Metadata.sourcePath) {
      var sourcePath = path.join(root, template.Resources[r].Metadata.sourcePath);
      var rule = require(sourcePath);
      if (process.env.NODE_ENV == 'test') {
        m.exports[rule.config.name] = rule.fn;
      } else {
        m.exports[rule.config.name] = streambot(rule.fn);
      }
    }
  }
}

function embed(lambdaPaths, template) {
  var parts = [];
  lambdaPaths.forEach(function(lambdaPath) {
    config = require(path.join(root, lambdaPath)).config;
    config.name = namespace(config.name,lambdaPath);
    config.sourcePath = lambdaPath;
    parts.push(build(config));
  });

  template = compile(parts, template);

  return template;
}
// builds template parts for a single rule
function build(options) {
  var resources = {};
  resources[options.name] = lambda(options);
  resources[options.name + 'Permission'] = lambdaPermission(options);
  resources['StreambotEnv' + options.name] = streambotEnv(options);
  if (options.snsRule) {
    resources[options.name + 'SNSTopic'] = lambdaSnsTopic(options);
    resources[options.name + 'SNSUser'] = lambdaSnsUser(options);
    resources[options.name + 'SNSUserAccessKey'] = lambdaSnsUserAccessKey(options);
  }
  if (options.eventRule) {
    resources[options.name + 'EventRule'] = cweRules(options,'eventRule');
  }
  if (options.scheduledRule) {
    resources[options.name + 'ScheduledRule'] = cweRules(options,'scheduledRule');
  }
  if (options.gatewayRule) {
    resources[options.name + 'GatewayRuleResource'] = gatewayRules(options,'resource');
    resources[options.name + 'GatewayRuleMethod'] = gatewayRules(options,'method');
  }
  var alarms = cloudwatch(options);
  for (var k in alarms) {
    resources[k] = alarms[k];
  }

  return {
    Parameters: parameters(options),
    Resources: resources,
    Policy: policy(options),
    Outputs: outputs(options)
  };
}

// builds all rule template parts into a template
function compile(parts, template) {
  if (!Array.isArray(parts)) throw new Error('parts must be an array');
  if (!template.AWSTemplateFormatVersion)
    template.AWSTemplateFormatVersion = "2010-09-09";
  if (!template.Description)
    template.Description = "LambdaCfn";

  if (!template.Parameters) template.Parameters = {};
  if (!template.Resources) template.Resources = {};
  if (!template.Outputs) template.Outputs = {};

  template.Parameters.CodeS3Bucket = {
    Type: 'String',
    Description: 'lambda function S3 bucket location'
  };
  template.Parameters.CodeS3Prefix = {
    Type: 'String',
    Description: 'lambda function S3 prefix location'
  };
  template.Parameters.GitSha = {
    Type: 'String',
    Description: 'lambda function S3 prefix location'
  };
  template.Parameters.StreambotEnv = {
    Type: 'String',
    Description: 'StreambotEnv lambda function ARN'
  };
  template.Parameters.AlarmEmail = {
    Type: 'String',
    Description: 'Alarm notifications will send to this email address'
  };

  var roleStub = role();
  var apiDeploymentDependsOn = [];

  parts.forEach(function(part) {
    // Parameters
    if (part.Parameters) {
      for (var p in part.Parameters) {
        if (template.Parameters[p])
          throw new Error('Duplicate parameter key' + template.Parameters[p]);
        template.Parameters[p] = part.Parameters[p];
      }
    }

    // Resources
    if (part.Resources) {
      for (var r in part.Resources) {
        if (r.match('GatewayRuleMethod')) {
          if (!template.Resources.ApiGateway) {
            template.Resources.ApiGateway = apiGateway();
            template.Resources.ApiKey = apiKey();
            template.Resources.ApiLatencyAlarm = apiLatencyAlarm();
            template.Resources.Api4xxAlarm = api4xxAlarm();
            template.Resources.ApiCountAlarm = apiCountAlarm();
            template.Outputs.APIKey = {
              "Value": {
                "Ref": "ApiKey"
              }
            };
          }
          apiDeploymentDependsOn.push(r);
        }
        if (template.Resources[r])
          throw new Error('Duplicate resource key' + r);
        template.Resources[r] = part.Resources[r];
      }
    }

    // Outputs
    if (part.Outputs) {
      for (var po in part.Outputs) {
        if (template.Outputs[po])
          throw new Error('Duplicate Output' + po);
        template.Outputs[po]=part.Outputs[po];
      }
    }

    // Monolithic role
    if (part.Policy) {
      roleStub.Properties.Policies.push(part.Policy);
    }
    template.Resources.LambdaCfnRole = roleStub;
  });

  // Alarm SNS topic
  template.Resources.LambdaCfnAlarmSNSTopic = snsTopic();

  if (template.Resources.ApiGateway) {

    template.Resources[apiDeploymentRandom] = apiDeployment(apiDeploymentDependsOn);
  }
  return template;
}

function parameters(options) {
  var namespacedParameters = {};
  for (var p in options.parameters) {
    if (!options.parameters[p].Type)
      throw new Error('Parameter must contain Type property');
    if (!options.parameters[p].Description)
      throw new Error('Parameter must contain Description property');
    namespacedParameters[stripPunc(options.name) + p] = options.parameters[p];
  }
  return namespacedParameters;
}

function cweRules(options,ruleType) {
  if (!options.name) throw new Error('name property required for cweRules');
  if (!ruleType) throw new Error('ruleType property required for cweRules');
  if (!ruleType.match(/eventRule|scheduledRule/)) throw new Error('unknown ruleType property: ' + ruleType);
  if (ruleType == 'eventRule' && !options.eventRule.eventPattern) throw new Error('eventPattern required for eventRule');
  if (ruleType == 'scheduledRule' && !options.scheduledRule) throw new Error('scheduled rule expression cannot be undefined');
  var cweRule = {};
  if (ruleType == 'eventRule') {
    cweRule = {
        "Type" : "AWS::Events::Rule",
        "Properties" : {
          "EventPattern" : options.eventRule.eventPattern,
          "RoleArn" : {
            "Fn::GetAtt": [
              "LambdaCfnRole",
              "Arn"
            ]
          },
          "State" : "ENABLED",
          "Targets" : [
            {
              "Arn": {
                "Fn::GetAtt": [
                  options.name,
                  "Arn"
                ]
              },
              "Id": options.name
            }
          ]
        }
      };
  } else if (ruleType == 'scheduledRule') {
    cweRule = {
      "Type" : "AWS::Events::Rule",
      "Properties" : {
        "ScheduleExpression": options.scheduledRule,
        "RoleArn" : {
          "Fn::GetAtt": [
            "LambdaCfnRole",
            "Arn"
          ]
        },
        "State" : "ENABLED",
        "Targets" : [
          {
            "Arn": {
              "Fn::GetAtt": [
                options.name,
                "Arn"
              ]
            },
            "Id": options.name
          }
        ]
      }
    };
  }

  return cweRule;

}

function lambda(options) {
  if (!options.name) throw new Error('name property required for lambda');
  var fn = {
    "Type": "AWS::Lambda::Function",
    "Properties": {
      "Code": {
        "S3Bucket": {
          "Ref": "CodeS3Bucket"
        },
        "S3Key": {
          "Fn::Join": [
            "",
            [
              {
                "Ref": "CodeS3Prefix"
              },
              {
                "Ref": "GitSha"
              },
              ".zip"
            ]
          ]
        }
      },
      "Role": {
        "Fn::GetAtt": [
          "LambdaCfnRole",
          "Arn"
        ]
      },
      "Description": {
        "Ref": "AWS::StackName"
      },
      "Handler": "index." + options.name,
      "Runtime": "nodejs4.3"
    },
    "Metadata": {
      "sourcePath": options.sourcePath
    }
  };

  if (options.timeout) {
    if (options.timeout <= 300) {
      fn.Properties.Timeout = options.timeout;
    } else {
      fn.Properties.Timeout = 60;
    }
  } else {
    fn.Properties.Timeout = 60;
  }

  if (options.memorySize) {
    if (options.memorySize >= 128 && options.memorySize <= 1536) {
      if ((options.memorySize % 64) == 0) {
        fn.Properties.MemorySize = options.memorySize;
      } else {
        fn.Properties.MemorySize = 128;
      }
    } else {
      fn.Properties.MemorySize = 128;
    }
  } else {
    fn.Properties.MemorySize = 128;
  }

  return fn;

}

function lambdaPermission(options) {
  if (!options.name) throw new Error('name property required for lambda');

  var perm = {};
  if (options.snsRule != undefined) {
    perm = {
      "Type": "AWS::Lambda::Permission",
      "Properties": {
        "FunctionName": {
          "Fn::GetAtt": [
            options.name,
            "Arn"
          ]
        },
        "Action": "lambda:InvokeFunction",
        "Principal": "sns.amazonaws.com",
        "SourceArn": {
          "Ref" : options.name + 'SNSTopic'
        }
      }
    };
  } else if (options.gatewayRule) {
    perm = {
      "Type": "AWS::Lambda::Permission",
      "Properties": {
        "FunctionName": {
          "Fn::GetAtt": [
            options.name,
            "Arn"
          ]
        },
        "Action": "lambda:InvokeFunction",
        "Principal": "apigateway.amazonaws.com",
        "SourceArn": {
          "Fn::Join": [
            "",
            [
              "arn:aws:execute-api:",
              {
                "Ref": "AWS::Region"
              },
              ":",
              {
                "Ref": "AWS::AccountId"
              },
              ":",
              {
                "Ref": "ApiGateway"
              },
              "/*"
            ]
          ]
        }
      }
    };
  } else {
    perm = {
      "Type": "AWS::Lambda::Permission",
      "Properties": {
        "FunctionName": {
          "Fn::GetAtt": [
            options.name,
            "Arn"
          ]
        },
        "Action": "lambda:InvokeFunction",
        "Principal": "events.amazonaws.com",
        "SourceArn": {
          "Fn::Join": [
            "",
            [
              "arn:aws:events:",
              {
                "Ref": "AWS::Region"
              },
              ":",
              {
                "Ref": "AWS::AccountId"
              },
              ":rule/",
              {
                "Ref": "AWS::StackName"
              },
              "*"
            ]
          ]
        }
      }
    };
  }

  return perm;

}

function apiGateway() {
  return {
    "Type": "AWS::ApiGateway::RestApi",
    "Properties": {
      "Name": {
        "Ref": "AWS::StackName"
      },
      "FailOnWarnings": "true"
    }
  };
}


function apiDeployment(dependsOn) {
  var apiDeploy =  {
    "Type": "AWS::ApiGateway::Deployment",
    "DependsOn": dependsOn,
    "Properties": {
      "RestApiId": {
        "Ref": "ApiGateway"
      },
      "StageName": "prod"
    }
  };
  return apiDeploy;
}

function apiKey() {
  return {
    "Type": "AWS::ApiGateway::ApiKey",
    "DependsOn": apiDeploymentRandom,
    "Properties": {
      "Name": {
        "Ref": "AWS::StackName"
      },
      "Enabled": "true",
      "StageKeys": [
        {
          "RestApiId": {
            "Ref": "ApiGateway"
          },
          "StageName": "prod"
        }
      ]
    }
  };
}

function apiLatencyAlarm() {
  return {
    "Type": "AWS::CloudWatch::Alarm",
    "Properties": {
      "EvaluationPeriods": "5",
      "Statistic": "Sum",
      "Threshold": "4",
      "AlarmDescription": "https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#ApiLatencyAlarm",
      "Period": "60",
      "AlarmActions": [
        {
          "Ref": "LambdaCfnAlarmSNSTopic"
        }
      ],
      "Namespace": "AWS/ApiGateway",
      "Dimensions": [
        {
          "Name": "APIName",
          "Value": {
            "Ref": "AWS::StackName"
          }
        }
      ],
      "ComparisonOperator": "GreaterThanThreshold",
      "MetricName": "Latency"
    }
  };
}

function api4xxAlarm() {
  return {
    "Type": "AWS::CloudWatch::Alarm",
    "Properties": {
      "EvaluationPeriods": "5",
      "Statistic": "Sum",
      "Threshold": "100",
      "AlarmDescription": "https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#Api4xxAlarm",
      "Period": "60",
      "AlarmActions": [
        {
          "Ref": "LambdaCfnAlarmSNSTopic"
        }
      ],
      "Namespace": "AWS/ApiGateway",
      "Dimensions": [
        {
          "Name": "APIName",
          "Value": {
            "Ref": "AWS::StackName"
          }
        }
      ],
      "ComparisonOperator": "GreaterThanThreshold",
      "MetricName": "4xxError"
    }
  };
}

function apiCountAlarm() {
  return {
    "Type": "AWS::CloudWatch::Alarm",
    "Properties": {
      "EvaluationPeriods": "5",
      "Statistic": "Sum",
      "Threshold": "10000",
      "AlarmDescription": "https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#ApiCountAlarm",
      "Period": "60",
      "AlarmActions": [
        {
          "Ref": "LambdaCfnAlarmSNSTopic"
        }
      ],
      "Namespace": "AWS/ApiGateway",
      "Dimensions": [
        {
          "Name": "APIName",
          "Value": {
            "Ref": "AWS::StackName"
          }
        }
      ],
      "ComparisonOperator": "GreaterThanThreshold",
      "MetricName": "Count"
    }
  };
}

function gatewayRules(options,apiPart) {
  if (!options.name) throw new Error('name property required for gateway rule');
  if (!apiPart) throw new Error('resource type required for gateway rule template');
  if (/resource|method/.test(apiPart) == false) {
    throw new Error('Invalid api gateway resource type');
  }
  if (/GET|HEAD|PUT|PATCH|OPTIONS|POST|DELETE/.test(options.gatewayRule.method.toUpperCase()) == false) {
    throw new Error('Invalid client HTTP method specified: ' + options.gatewayRule.method);
  }
  var apiTemplate = {};
  if (apiPart == 'resource') {
    return {
      "Type": "AWS::ApiGateway::Resource",
      "Properties": {
        "ParentId": {
          "Fn::GetAtt": [
            "ApiGateway",
            "RootResourceId"
          ]
        },
        "RestApiId": {
          "Ref": "ApiGateway"
        },
        "PathPart": options.name.toLowerCase()
      }
    };
  }
  if (apiPart == 'method') {
    if (options.gatewayRule.methodResponses && Array.isArray(options.gatewayRule.methodResponses)) {
    } else {
      options.gatewayRule.methodResponses = [
        {
          "StatusCode": "200",
          "ResponseModels": {
            "application/json": "Empty"
          }
        },
        {
          "StatusCode": "500",
          "ResponseModels": {
            "application/json": "Empty"
          }
        }
      ];
    }

    if (options.gatewayRule.integrationResponses && Array.isArray(options.gatewayRule.integrationResponses)) {
    } else {
      options.gatewayRule.integrationResponses = [
        {
          "StatusCode":"200"
        },
        {
          "StatusCode":"500",
          "SelectionPattern": "^(?i)(error|exception).*"
        }
      ];
    }

    apiTemplate = {
      "Type": "AWS::ApiGateway::Method",
      "Properties": {
        "RestApiId": {
          "Ref": "ApiGateway"
        },
        "ResourceId": {
          "Ref": options.name + 'GatewayRuleResource'
        },
        "AuthorizationType": "None",
        "HttpMethod": options.gatewayRule.method.toUpperCase(),
        "MethodResponses": options.gatewayRule.methodResponses,
        "Integration": {
          "Type": "AWS",
          "IntegrationHttpMethod": "POST",
          "IntegrationResponses": options.gatewayRule.integrationResponses,
          "Uri": {
            "Fn::Join": [
              "",
              [
                "arn:aws:apigateway:",
                {
                  "Ref": "AWS::Region"
                },
                ":lambda:path/2015-03-31/functions/",
                {
                  "Fn::GetAtt":
                  [
                    options.name,
                    "Arn"
                  ]
                },
                "/invocations"
              ]
            ]
          }
        }
      }
    };

    if (options.gatewayRule.apiKey) {
      apiTemplate.Properties.ApiKeyRequired = "true";
    }
  }
  return apiTemplate;
}


function lambdaSnsUser(options) {
  if (!options.name) throw new Error('name property required for lambda SNS User');
  var user = {
    "Type": "AWS::IAM::User",
    "Properties": {
      "Policies": [
        {
          "PolicyName": options.name + 'SNSTopicPolicy',
          "PolicyDocument": {
            "Version": "2012-10-17",
            "Statement": [
              {
                "Resource": [
                  {
                    "Ref": options.name + "SNSTopic"
                  }
                ],
                "Action": [
                  "sns:ListTopics",
                  "sns:Publish",
                ],
                "Effect": "Allow"
              },
              {
                "Resource": [
                  {
                    "Fn::Join": [
                      "",
                      [
                        "arn:aws:sns:",
                        {
                          "Ref": "AWS::Region"
                        },
                        ":",
                        {
                          "Ref": "AWS::AccountId"
                        },
                        ":*"
                      ]
                    ]
                  }
                ],
                "Action": [
                  "sns:ListTopics",
                ],
                "Effect": "Allow"
              }
            ]
          }
        }
      ]
    }
  };
  return user;
};

function lambdaSnsUserAccessKey(options) {
  if (!options.name) throw new Error('name property required for lambda SNS User Access Key');
  var key = {
    "Type": "AWS::IAM::AccessKey",
    "Properties": {
      "UserName": {
        "Ref": options.name + "SNSUser"
      }
    }
  };
  return key;
}

function lambdaSnsTopic(options) {
  if (!options.name) throw new Error('name property required for lambda SNS Topic');
  var topic = {
    "Type": "AWS::SNS::Topic",
    "Properties": {
      "DisplayName": {
        "Fn::Join": [
          "-",
          [
            {
              "Ref": "AWS::StackName"
            },
            options.name
          ]
        ]
      },
      "TopicName": {
        "Fn::Join": [
          "-",
          [
            {
              "Ref": "AWS::StackName"
            },
            options.name
          ]
        ]
      },
      "Subscription": [
        {
          "Endpoint": {
            "Fn::GetAtt": [
              options.name,
              "Arn"
            ]
          },
          "Protocol": "lambda"
        }
      ]
    }
  };
  return topic;
};

function role() {

  var role = {
    "Type": "AWS::IAM::Role",
    "Properties": {
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Sid": "",
            "Effect": "Allow",
            "Principal": {
              "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
          },
          {
            "Sid": "",
            "Effect": "Allow",
            "Principal": {
              "Service": "apigateway.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
          },
          {
            "Sid": "",
            "Effect": "Allow",
            "Principal": {
              "Service": "events.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
          }
        ]
      },
      "Path": "/",
      "Policies": [
        {
          "PolicyName": "basic",
          "PolicyDocument": {
            "Statement": [
              {
                "Effect": "Allow",
                "Action": [
                  "logs:*"
                ],
                "Resource": "arn:aws:logs:*:*:*"
              },
              {
                "Effect": "Allow",
                "Action": [
                  "dynamodb:GetItem"
                ],
                "Resource": {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:dynamodb:us-east-1:",
                      {
                        "Ref": "AWS::AccountId"
                      },
                      ":table/streambot-env*"
                    ]
                  ]
                }
              },
              {
                "Effect": "Allow",
                "Action": [
                  "sns:Publish"
                ],
                "Resource": {
                  "Ref": "LambdaCfnAlarmSNSTopic"
                }
              },
              {
                "Effect": "Allow",
                "Action": [
                  "iam:SimulateCustomPolicy"
                ],
                "Resource": "*"
              }
            ]
          }
        }
      ]
    }
  };

  return role;

}

function policy(options) {
  if (!options.statements) return;
  if (!options.name)
    throw new Error('name property required for policy');
  if (options.statements && !Array.isArray(options.statements))
    throw new Error('options.statements must be an array');

  // Very basic validation on each policy statement
  options.statements.forEach(function(statement) {
    if (!statement.Effect)
      throw new Error('statement must contain Effect');
    if (!statement.Resource && !statement.NotResource)
      throw new Error('statement must contain Resource or NotResource');
    if (!statement.Action && !statement.NotAction)
      throw new Error('statement must contain Action or NotAction');
  });

  var policy = {
    PolicyName: options.name,
    PolicyDocument: {
      Statement: options.statements
    }
  };

  return policy;

}

function outputs(options) {
  if (!options.name) throw new Error('name property required for template outputs');
  var output = {};

  if (options.snsRule) {
    output[options.name + 'SNSTopic'] = {
      "Value": {
        "Ref": options.name + 'SNSTopic'
      }
    };
    output[options.name + 'SNSUserAccessKey'] = {
      "Value": {
        "Ref": options.name + 'SNSUserAccessKey'
      }
    };
    output[options.name + 'SNSUserSecretAccessKey'] = {
      "Value": {
        "Fn::GetAtt": [
          options.name + 'SNSUserAccessKey',
          "SecretAccessKey"
        ]
      }
    };
  }
  if (options.gatewayRule) {
    output[options.name + 'APIEndpoint'] = {
      "Value": {
        "Fn::Join": [
          "",
          [
            "https://",
            {
              "Ref": "ApiGateway"
            },
            ".execute-api.",
            {
              "Ref": "AWS::Region"
            },
            ".amazonaws.com/prod/",
            options.name.toLowerCase()
          ]
        ]
      }
    };
  }

  return output;
}

function streambotEnv(options) {
  if (!options.name)
    throw new Error('name property required for streambotEnv');

    var env = {
      "Type": "Custom::StreambotEnv",
      "Properties": {
        "ServiceToken": {
          "Ref": "StreambotEnv"
        },
        "FunctionName": {
          "Ref": options.name
        }
      }
    };

  var p = !options.parameters ? {} :
      JSON.parse(JSON.stringify(parameters(options)));

  // make some global env vars available
  p.LambdaCfnAlarmSNSTopic = true;

  for (var k in p) {
    env.Properties[k] = { Ref: k };
  }

  return env;

}

function cloudwatch(options) {
  if (!options.name) throw new Error('name property required for cloudwatch');

  var alarms = {};

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
    alarms[options.name + 'Alarm' + alarm.AlarmName] = {
      "Type": "AWS::CloudWatch::Alarm",
      "Properties": {
        "EvaluationPeriods": "5",
        "Statistic": "Sum",
        "Threshold": "0",
        "AlarmDescription": "https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#" + alarm.AlarmName,
        "Period": "60",
        "AlarmActions": [
          {
            "Ref": "LambdaCfnAlarmSNSTopic"
          }
        ],
        "Namespace": "AWS/Lambda",
        "Dimensions": [
          {
            "Name": "FunctionName",
            "Value": {
              "Ref": options.name
            }
          }
        ],
        "ComparisonOperator": alarm.ComparisonOperator,
        "MetricName": alarm.MetricName
      }
    };

  });

  return alarms;

}

function snsTopic(options) {
  return {
    "Type": "AWS::SNS::Topic",
    "Properties": {
      "TopicName": {
        "Ref": "AWS::StackName"
      },
      "Subscription": [
        {
          "Endpoint": {
            "Ref": "AlarmEmail"
          },
          "Protocol": "email"
        }
      ]
    }
  };
}

function splitOnComma (str) {
  if (str) {
    return str.split(/\s*,\s*/);
  } else {
    // splitting unset parameter shouldn't return a non-falsey value
    return '';
  }
}

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
      TopicArn: process.env.LambdaCfnAlarmSNSTopic
    };
    sns.publish(params, function(err, data) {
      callback(err, data);
    });
  }

}

function getEnv(envVar) {
  for (var key in process.env) {
    if(key.indexOf(envVar) > -1) {
      return process.env[key];
    }
  }
  //mimic unset parameter if not found
  return '';
}
