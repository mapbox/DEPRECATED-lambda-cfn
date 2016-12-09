var fs = require('fs');
var path = require('path');
var tape = require('tape');
var lambdaCfn = require('../lib/lambda-cfn');
const util = require('util');


tape('Compile unit tests', function(t) {

  t.throws(
    function() {
      lambdaCfn.compile('foo');
    }, '/must be an array/', 'compile takes array first parameter');

  var simpleBuilt = lambdaCfn.compile([lambdaCfn.build({
    name: 'simple',
    runtime: 'nodejs4.3',
    sourcePath: 'rules/myRule.js'
  })], {});

  var simpleFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/simple.template'), "utf8"));

  t.deepEqual(simpleBuilt, simpleFixture, 'simple build is equal to fixture');

  var fullConfig = {
    name: 'full',
    runtime: 'nodejs4.3',
    sourcePath: 'rules/myRule.js',
    parameters: {
      'githubToken': {
        'Type': 'String',
        'Description': 'Github API token with users scope',
      },
      'myBucket': {
        'Type': 'String',
        'Description': 'Bucket where to store'
      }
    },
    statements: [
      {
        "Effect": "Allow",
        "Action": [
          "s3:GetObject"
        ],
        "Resource": "arn:aws:s3:::mySuperDuperBucket"
      }
    ]
  };

  var fullBuilt = lambdaCfn.compile([lambdaCfn.build(fullConfig)], {});
  var fullFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/full.template'), "utf8"));

    t.deepEqual(fullBuilt, fullFixture, 'full build is equal to fixture');

  t.end();

});

tape('Compile SNS rule', function(t) {
  var snsConfig = {
    name: 'sns',
    runtime: 'nodejs',
    sourcePath: 'rules/sns.js',
    parameters: {
      'token': {
        'Type': 'String',
        'Description': 'token'
      }
    },
    snsRule: {}
  };

  var snsBuilt = lambdaCfn.compile([lambdaCfn.build(snsConfig)], {});
  var snsFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/sns.template'), "utf8"));

  t.deepEqual(snsBuilt,snsFixture, 'SNS rule build is equal to fixture');

  t.end();
});


tape('Compile Event rule', function(t) {
  var eventConfig = {
    name: 'eventRule',
    runtime: 'nodejs4.3',
    sourcePath: 'rules/eventRule.js',
    parameters: {
      'token': {
        'Type': 'String',
        'Description': 'token'
      }
    },
    eventRule: {
      eventPattern:{
        'detail-type': [
          'AWS API Call via CloudTrail'
        ],
        detail: {
          eventSource: [
            'iam.amazonaws.com'
          ],
          eventName: [
            'CreatePolicy',
            'CreatePolicyVersion',
            'PutGroupPolicy',
            'PutRolePolicy',
            'PutUserPolicy'
          ]
        }
      }
    }
  };

  var eventBuilt = lambdaCfn.compile([lambdaCfn.build(eventConfig)], {});
  var eventFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/event.template'), "utf8"));

    t.deepEqual(eventBuilt,eventFixture, 'Event rule build is equal to fixture');

  t.end();
});

tape('Compile Scheduled rule', function(t) {
  var scheduledConfig = {
    name: 'scheduledRule',
    runtime: 'nodejs',
    sourcePath: 'rules/scheduledRule.js',
    parameters: {
      'token': {
        'Type': 'String',
        'Description': 'token'
      }
    },
    scheduledRule: 'rate(5 minutes)'
  };

  var scheduledBuilt = lambdaCfn.compile([lambdaCfn.build(scheduledConfig)], {});
  var scheduledFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/scheduled.template'), "utf8"));

  t.deepEqual(scheduledBuilt,scheduledFixture, 'Scheduled rule build is equal to fixture');

  t.end();
});


tape('Compile Hybrid Scheduled and Hybrid based rule', function(t) {
  var hybridConfig = {
    name: 'hybridRule',
    runtime: 'nodejs4.3',
    sourcePath: 'rules/hybridRule.js',
    parameters: {
      'token': {
        'Type': 'String',
        'Description': 'token'
      }
    },
    eventRule: {
      eventPattern:{
        'detail-type': [
          'AWS API Call via CloudTrail'
        ],
        detail: {
          eventSource: [
            'iam.amazonaws.com'
          ],
          eventName: [
            'CreatePolicy',
            'CreatePolicyVersion',
            'PutGroupPolicy',
            'PutRolePolicy',
            'PutUserPolicy'
          ]
        }
      }
    },
    scheduledRule: 'rate(5 minutes)'
  };

  var hybridBuilt = lambdaCfn.compile([lambdaCfn.build(hybridConfig)], {});
  var hybridFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/hybrid.template'), "utf8"));
  t.deepLooseEqual(hybridBuilt,hybridFixture, 'Hybrid rule build is equal to fixture');

  t.end();
});

tape('Compile ApiGateway based rule', function(t) {
  var gatewayConfig = {
    name: 'gatewayTestRule',
    runtime: 'nodejs',
    sourcePath: 'test/rules/gatewayTestRule.js',
    parameters: {
      'token': {
        'Type': 'String',
        'Description': 'token'
      }
    },
    gatewayRule: {
      method: "POST",
      apiKey: true
    }
  };

  var gatewayBuilt = lambdaCfn.compile([lambdaCfn.build(gatewayConfig)], {});
  var gatewayFixture = JSON.parse(fs.readFileSync(path.join(__dirname,'./fixtures/gateway.template'),"utf8"));

  t.deepLooseEqual(gatewayBuilt,gatewayFixture, 'Gateway rule build is equal to fixture');
  t.end();
});
