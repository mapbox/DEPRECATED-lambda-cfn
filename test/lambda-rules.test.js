var tape = require('tape');
var lambdaRules = require('../bin/lambda-cfn-rules');
var nock = require('nock');

var getMatchedRules = lambdaRules.getMatchedRules;
var removeTargets = lambdaRules.removeTargets;
var deleteRuleset = lambdaRules.deleteRuleset;
var testRules = lambdaRules.matchedRules;
var argv = lambdaRules.argv;

argv.prefix = 'test';

if (process.env.AWS_ACCESS_KEY_ID == undefined) {
  process.env.AWS_ACCESS_KEY_ID = 'fakefakefake';
  process.env.AWS_SECRET_ACCESS_KEY = 'fakefakefake';
}

tape('get matching rules', function(t) {
  var ruleReq = nock('https://events.us-east-1.amazonaws.com:443', {"encodedQueryParams":true})
       .post('/', {"NamePrefix":"test"})
       .reply(200, {"Rules":[{"Arn":"test-rule1","Name":"test-rule1"},{"Arn":"test-rule2","Name":"test-rule2"},{"Arn":"test-rule3","Name":"test-rule3"}]});

  getMatchedRules(function(err,data) {
    t.ok(ruleReq.isDone(),'List rules API request made');
    t.equal(testRules.length,3,'Correct number of rules found');
    testRules.forEach(function(rule) {
      if (rule.config.stackRuleName.indexOf('test') == 0) {
        t.pass(rule.config.stackRuleName + ' matches query filter');
      } else {
        t.fail(rule.config.stackRuleName + ' does not match query filter');
      }
    });
    t.end();
  });
});

tape('removing rule targets', function(t) {
  var rule1List = nock('https://events.us-east-1.amazonaws.com:443', {"encodedQueryParams":true})
        .post('/', {"Rule":"test-rule1"})
        .reply(200, {"Targets":[{"Arn":"lambda-test-rule1","Id":"lambda-test-rule1"}]});
  var rule2List = nock('https://events.us-east-1.amazonaws.com:443', {"encodedQueryParams":true})
        .post('/', {"Rule":"test-rule2"})
        .reply(200, {"Targets":[{"Arn":"lambda-test-rule2","Id":"lambda-test-rule2"}]});
  var rule3List = nock('https://events.us-east-1.amazonaws.com:443', {"encodedQueryParams":true})
        .post('/', {"Rule":"test-rule3"})
        .reply(200, {"Targets":[{"Arn":"lambda-test-rule3","Id":"lambda-test-rule3"},{"Arn":"lambda-test-rule33","Id":"lambda-test-rule33"}]});

  var rule1Remove = nock('https://events.us-east-1.amazonaws.com:443', {"encodedQueryParams":true})
        .post('/', {"Rule":"test-rule1","Ids":["lambda-test-rule1"]})
        .reply(200, {"FailedEntries":[],"FailedEntryCount":0});
  var rule2Remove = nock('https://events.us-east-1.amazonaws.com:443', {"encodedQueryParams":true})
        .post('/', {"Rule":"test-rule2","Ids":["lambda-test-rule2"]})
        .reply(200, {"FailedEntries":[],"FailedEntryCount":0});
  var rule3Remove = nock('https://events.us-east-1.amazonaws.com:443', {"encodedQueryParams":true})
        .post('/', {"Rule":"test-rule3", "Ids": ["lambda-test-rule3","lambda-test-rule33"]})
        .reply(200, {"FailedEntries":[],"FailedEntryCount":0});

  removeTargets(testRules,function(err,data) {
    t.ok(rule1List.isDone(),'Fetched test rule 1 targets');
    t.ok(rule2List.isDone(),'Fetched test rule 2 targets');
    t.ok(rule3List.isDone(),'Fetched test rule 3 targets');
    t.ok(rule1Remove.isDone(),'Removed target for test rule 1');
    t.ok(rule2Remove.isDone(),'Removed target for test rule 2');
    t.ok(rule3Remove.isDone(),'Removed targets for test rule 3');
    t.end();
  });
});

tape('all API requests successfully made', function(t) {
  t.ok(nock.isDone(),"All nock'ed API requests completed");
  t.end();
});
