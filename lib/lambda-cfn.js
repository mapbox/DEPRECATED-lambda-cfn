var path = require('path');
var fs = require('fs');
var streambot = require('streambot');
var AWS = require('aws-sdk');
var root = process.env.LAMBDA_TASK_ROOT ?
      process.env.LAMBDA_TASK_ROOT :
      require('app-root-path').path;

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

function stripHyphens(r) {
    return r.replace(/-/g, '');
}

function namespace(name,path) {
  var namePrefix;
  for (var i = 0; i < module.children.length; i++) {
    if (module.children[i].id.match(path)) {
      var regex = '([^/]*)/rules/[^/]*.js$';
      namePrefix = module.children[i].id.match(regex);
      break;
    }
  }
  if (namePrefix) {
    return (namePrefix[1] + '-' + name);
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
    var roleStub = role();
    if (part.Policy)
      roleStub.Properties.Policies.push(part.Policy);
    template.Resources.LambdaCfnRole = roleStub;

  });

  // Alarm SNS topic
  template.Resources.LambdaCfnAlarmSNSTopic = snsTopic();

  return template;

}

function parameters(options) {
  for (var p in options.parameters) {
    if (!options.parameters[p].Type)
      throw new Error('Parameter must contain Type property');
    if (!options.parameters[p].Description)
      throw new Error('Parameter must contain Description property');
    options.parameters[stripHyphens(options.name) + p] = options.parameters[p];
    delete options.parameters[p];
  }
  return options.parameters;
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
      "Runtime": "nodejs"
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
  if (!options.snsRule) return;
  var output = {};

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
      JSON.parse(JSON.stringify(options.parameters));

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
  return str.split(/\s*,\s*/);
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
      envVar = process.env[key];
    }
  }
  return envVar;
}
