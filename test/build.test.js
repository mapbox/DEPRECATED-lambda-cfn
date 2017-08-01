var fs = require('fs');
var path = require('path');
var tape = require('tape');
var lambdaCfn = require('../lib/lambda-cfn');
var util = require('util');


tape('Compile unit tests', function(t) {

  t.throws(
    function() {
      lambdaCfn.build({});
    }, 'Function name is required', 'Function name is required'
  );

  t.throws(
    function() {
      lambdaCfn.build({
        name: 'test',
        runtime: 'badNodejs'
      });
    }, 'Invalid AWS Lambda node.js runtime badNodejs', 'bad runtime'
  );

  var simpleBuilt = lambdaCfn.build({
    name: 'simple'
  });

  var simpleFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/simple.template'), "utf8"));

  t.deepEqual(simpleBuilt, simpleFixture, 'simple build is equal to fixture');

  var fullConfig = {
    name: 'full',
    runtime: 'nodejs4.3',
    parameters: {
      githubToken: {
        Type: 'String',
        Description: 'Github API token with users scope'
      },
      myBucket: {
        Type: 'String',
        Description: 'Bucket where to store'
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

  var fullBuilt = lambdaCfn.build(fullConfig);
  var fullFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/full.template'), "utf8"));

  t.deepEqual(fullBuilt, fullFixture, 'full build is equal to fixture');

  t.end();

});

tape('Compile SNS rule', function(t) {
  var snsConfig = {
    name: 'sns',
    parameters: {
      token: {
        Type: 'String',
        Description: 'token'
      }
    },
    eventSources: {
      sns: {}
    }
  };

  var snsBuilt = lambdaCfn.build(snsConfig);
  var snsFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/sns.template'), "utf8"));

  t.deepEqual(snsBuilt,snsFixture, 'SNS rule build is equal to fixture');

  t.end();
});


tape('Compile Event rule', function(t) {
  var eventConfig = {
    name: 'eventRule',
    runtime: 'nodejs4.3',
    parameters: {
      token: {
        Type: 'String',
        Description: 'token'
      }
    },
    eventSources: {
      cloudwatchEvent: {
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
    }
  };

  var eventBuilt = lambdaCfn.build(eventConfig);
  var eventFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/event.template'), "utf8"));

  t.deepEqual(eventBuilt,eventFixture, 'Event rule build is equal to fixture');

  t.end();
});

tape('Compile Scheduled rule', function(t) {
  var scheduledConfig = {
    name: 'scheduledRule',
    runtime: 'nodejs4.3',
    parameters: {
      token: {
        Type: 'String',
        Description: 'token'
      }
    },
    eventSources: {
      schedule: {
        expression: 'rate(5 minutes)'
      }
    }
  };

  var scheduledBuilt = lambdaCfn.build(scheduledConfig);
  var scheduledFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/scheduled.template'), "utf8"));

  t.deepEqual(scheduledBuilt,scheduledFixture, 'Scheduled rule build is equal to fixture');

  t.end();
});


tape('Compile Hybrid Scheduled and Hybrid based rule', function(t) {
  var hybridConfig = {
    name: 'hybridRule',
    runtime: 'nodejs4.3',
    parameters: {
      token: {
        Type: 'String',
        Description: 'token'
      }
    },
    eventSources: {
      cloudwatchEvent: {
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
      schedule: {
        expression: 'rate(5 minutes)'
      }
    }
  };

  var hybridBuilt = lambdaCfn.build(hybridConfig);
  var hybridFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/hybrid.template'), "utf8"));

  t.deepLooseEqual(hybridBuilt,hybridFixture, 'Hybrid rule build is equal to fixture');

  t.end();
});

tape('Compile ApiGateway based rule', function(t) {
  var gatewayConfig = {
    name: 'gatewayTestRule',
    runtime: 'nodejs4.3',
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

  var gatewayBuilt = lambdaCfn.build(gatewayConfig);
  var gatewayFixture = JSON.parse(fs.readFileSync(path.join(__dirname,'./fixtures/gateway.template'),"utf8"));

  t.deepLooseEqual(gatewayBuilt,gatewayFixture, 'Gateway rule build is equal to fixture');
  t.end();
});
