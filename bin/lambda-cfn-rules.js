#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var AWS = require('aws-sdk');
var queue = require('queue-async');

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
var q = queue(1);
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
  var q = queue();
  rules.forEach(function(rule) {
    if (rule.config.eventRule) {
      var name = stackName + '-' + rule.config.name;
      var ruleParams = {
        Name: name,
        EventPattern: JSON.stringify(rule.config.eventRule.eventPattern),
        RoleArn: rule.roleArn
      };
      var targetParams = {
        Rule: name,
        Targets: [
          {
            Arn: rule.arn,
            Id: name,
          }
        ]
      };
      q.defer(function(next) {
        cwe.putRule(ruleParams, function(err, res) {
          if (err) return next(err);
          cwe.putTargets(targetParams, function(err, res) {
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
  var q = queue();

  cfn.describeStackResources({StackName: stackName}, function(err, data) {
    if (err) throw err;
      // Decorate rules with info needed to create Event Rules
      rules.forEach(function(rule, i) {
        if (rule.config && rule.config.eventRule) {
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
