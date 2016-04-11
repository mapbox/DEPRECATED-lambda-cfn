#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var AWS = require('aws-sdk');
var d3 = require('d3-queue');

if (!process.argv[2])
  throw new Error('Must provide name of CloudFormation stack as first argument');

var rules = [];
var files = fs.readdirSync(path.join(process.cwd(), 'cloudformation'));

for (var i = 0; i < files.length; i++) {
  var file = files[i];
  if (path.extname(file) == '.js' && file.indexOf('.template.') > -1) {
    templateFile = path.join(process.cwd(), 'cloudformation', file);
    break;
  }
}

var template = require(templateFile);
for (var r in template.Resources) {
  if (template.Resources[r].Type == 'AWS::Lambda::Function' &&
      template.Resources[r].Metadata &&
      template.Resources[r].Metadata.sourcePath) {
    var sourcePath = path.join(process.cwd(), template.Resources[r].Metadata.sourcePath);
    var rule = require(sourcePath);
    rules.push(rule);
  }
}

var stackName = process.argv[2];
var region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
var q = d3.queue(1);
var cfn = new AWS.CloudFormation({region: region});
var cwe = new AWS.CloudWatchEvents({region: region});
var lambda = new AWS.Lambda({region: region});

q.defer(getStackResources);
q.defer(createEventRules);
q.awaitAll(function(err) {
  if (err) throw err;
  else console.log('CloudWatch Event Rules created');
});

function createEventRules(callback) {
  var q = d3.queue();
  rules.forEach(function(rule) {
    var name = stackName + '-' + rule.config.name;
    if (rule.config.eventRule) {
      var eName = name + '-event';
      var eRuleParams = {
        Name: eName,
        RoleArn: rule.roleArn,
        EventPattern: JSON.stringify(rule.config.eventRule.eventPattern)
      };
      var eTargetParams = {
        Rule: eName,
        Targets: [
          {
            Arn: rule.arn,
            Id: eName
          }
        ]
      };
      q.defer(function(next) {
        cwe.putRule(eRuleParams, function(err, res) {
          if (err) return next(err);
          cwe.putTargets(eTargetParams, function(err, res) {
            next(err);
          });
        });
      });
    }
    if (rule.config.scheduledRule) {
      var sName = name + '-scheduled';
      var sRuleParams = {
        Name: sName,
        RoleArn: rule.roleArn,
        ScheduleExpression: rule.config.scheduledRule
      };
      var sTargetParams = {
        Rule: sName,
        Targets: [
          {
            Arn: rule.arn,
            Id: sName
          }
        ]
      };
      q.defer(function(next) {
        cwe.putRule(sRuleParams, function(err, res) {
          if (err) return next(err);
          cwe.putTargets(sTargetParams, function(err, res) {
            next(err);
          });
        });
      });
    }
  });

  q.awaitAll(function(err) {
  callback(err);
  });
}

function getStackResources(callback) {
  var q = d3.queue();

  cfn.describeStackResources({StackName: stackName}, function(err, data) {
    if (err) throw err;
      // Decorate rules with info needed to create Event Rules
      rules.forEach(function(rule, i) {
        if (rule.config && (rule.config.eventRule || rule.config.scheduledRule)) {
          data.StackResources.forEach(function(e) {
            if (e.ResourceType === 'AWS::Lambda::Function' &&
              e.LogicalResourceId === rule.config.name) {
              q.defer(function(next) {
                lambda.getFunction({FunctionName: e.PhysicalResourceId}, function(err, lambdaData) {
                  if (err) return next(err);
                  rules[i].roleArn = lambdaData.Configuration.Role;
                  rules[i].id = lambdaData.Configuration.FunctionName;
                  rules[i].arn = lambdaData.Configuration.FunctionArn;
                  next(err);
                });
              });
            }
          });
        }
      });
      q.awaitAll(function(err) {
        callback(err);
      });
  });
}
