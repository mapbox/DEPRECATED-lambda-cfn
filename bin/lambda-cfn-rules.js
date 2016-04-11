#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var AWS = require('aws-sdk');
var d3 = require('d3-queue');
var inquirer = require('inquirer');
var argv = require('yargs')
      .usage('Usage: $0 <command> [options]')
      .demand(1)
      .command('create <stack>','creates CloudWatch Event Rules for a Patrol stack')
      .command('list <prefix>','list CloudWatch Event Rules matching the given prefix string')
      .command('delete <prefix>','deletes CloudWatch Event Rules matching the given prefix string')
      .argv;

var lambdaCfnRules = module.exports;
lambdaCfnRules.getMatchedRules = getMatchedRules;
lambdaCfnRules.deleteRuleset = deleteRuleset;
lambdaCfnRules.removeTargets = removeTargets;
lambdaCfnRules.argv = argv;

var rules = [];
var matchedRules = [];
lambdaCfnRules.matchedRules = matchedRules;



if (process.env.NODE_ENV == 'test') {
  var files = fs.readdirSync(path.join(process.cwd(), 'test/cloudformation'));
} else {
  var files = fs.readdirSync(path.join(process.cwd(), 'cloudformation'));
}

for (var i = 0; i < files.length; i++) {
  var file = files[i];
  if (path.extname(file) == '.js' && file.indexOf('.template.') > -1) {
    if (process.env.NODE_ENV == 'test') {
      templateFile = path.join(process.cwd(), 'test/cloudformation/lambda-rules.template.js');
    } else {
      templateFile = path.join(process.cwd(), 'cloudformation', file);
    }
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
    rule.config.stackRuleName = argv.stack + '-' + rule.config.name;
    rules.push(rule);
  }
}

var stackName = argv.stack;
var region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
var q = d3.queue(1);
var cfn = new AWS.CloudFormation({region: region});
var cwe = new AWS.CloudWatchEvents({region: region});
var lambda = new AWS.Lambda({region: region});

if (argv._ == 'create') {
  q.defer(getStackResources);
  q.defer(createEventRules);
  q.awaitAll(function(err) {
    if (err) throw err;
    else console.log('CloudWatch Event Rules creation complete');
  });
}

if (argv._ == 'delete') {
  q.defer(getMatchedRules);
  q.defer(listRules);
  q.defer(deleteRules);
  q.awaitAll(function(err) {
    if (err) throw err;
    else console.log('CloudWatch Event Rules deletion complete');
  });
}

if (argv._ == 'list') {
  q.defer(getMatchedRules);
  q.defer(listRules);
  q.awaitAll(function(err) {
    if (err) throw err;
  });
}

function deleteRules(callback) {
  inquirer.prompt([
    {
      type: 'confirm',
      message: 'Please confirm the deletion of the CloudWatch rules',
      name: 'delete',
      default: false
    }
  ]).then(function(answers) {
    if (answers.delete == true) {
      deleteRuleset(matchedRules, function(err){
        if (err) return callback(err);
        return callback();
      });
    } else {
      callback();
    }
  });
}

function listRules(callback) {
  if (matchedRules.length > 0) {
    matchedRules.forEach(function(rule) {
      console.log(rule.config.stackRuleName);
    });
    callback();
  } else {
    callback(new Error('No matching rules found'));
  }
};

function deleteRuleset(ruleset, callback) {
  var q = d3.queue(1);
  q.defer(removeTargets,ruleset);
  ruleset.forEach(function(rule) {
    var deleteParams = { Name: rule.config.stackRuleName };
    q.defer(function(next) {
      cwe.deleteRule(deleteParams, function(err,res) {
        if (err && err.code == 'ValidationException') {
          console.log('ERROR: ' + rule.config.stackRuleName + ' still has targets, skipping..');
          return next();
        }
        if (err) return next(err);
        console.log('DELETED: '+ rule.config.stackRuleName);
        next();
      });
    });
  });
  q.awaitAll(function(err) {
    callback(err);
  });
};

function removeTargets(ruleset, callback) {
  var q = d3.queue(1);
  ruleset.forEach(function(rule) {
    var listParams = { Rule: rule.config.stackRuleName };
    q.defer(function(next) {
      cwe.listTargetsByRule(listParams, function(err,res) {
        if (err) return next(err);
        if (res.Targets.length > 0) {
          var targets = [];
          res.Targets.forEach(function(target) {
            targets.push(target.Id);
          });
          var removeTargets = { Rule: rule.config.stackRuleName, Ids: targets};
          cwe.removeTargets(removeTargets, function(err,res) {
            if (err) return next(err);
            next();
          });
        } else {
          next();
        }
      });
    });
  });
  q.awaitAll(function(err) {
    callback(err);
  });
};

function getMatchedRules(callback) {
  var q = d3.queue(1);
  var listParams = { NamePrefix: argv.prefix };
  function findRules(params, next) {
    cwe.listRules(params, function(err,res) {
      if (err) return next(err);
      res.Rules.forEach(function(rule) {
        var rname = {
          config:
          {
            stackRuleName: rule.Name
          }
        };
        matchedRules.push(rname);
      });
      if (res.NextToken) {
        listParams.NextToken = res.NextToken;
        findRules(listParams,next);
      } else {
        next();
      }
    });
  };
  q.defer(findRules,listParams);
  q.awaitAll(function(err) {
    callback(err);
  });
};

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
      console.log('CREATED: ' + eName);
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
      console.log('CREATED: ' + sName);
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
