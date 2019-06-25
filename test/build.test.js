var fs = require('fs');
var path = require('path');
var tape = require('tape');
var lambdaCfn = require('../index.js');

tape('Template unit tests', function(t) {
  var simpleBuilt = lambdaCfn.build({ name: 'simple' });
  if (process.env.UPDATE) {
    fs.writeFileSync(path.join(__dirname,'./fixtures/simple.template.json'), JSON.stringify(simpleBuilt, null, 2), 'utf8');
  }
  var simpleFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/simple.template.json'), 'utf8'));
  t.deepEqual(simpleBuilt, simpleFixture, 'simple build is equal to fixture');

  var fullConfig = {
    name: 'full',
    runtime: 'nodejs10.x',
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
        'Effect': 'Allow',
        'Action': [
          's3:GetObject'
        ],
        'Resource': 'arn:aws:s3:::mySuperDuperBucket'
      }
    ]
  };

  var fullBuilt = lambdaCfn.build(fullConfig);
  if (process.env.UPDATE) {
    fs.writeFileSync(path.join(__dirname,'./fixtures/full.template.json'), JSON.stringify(fullBuilt, null, 2), 'utf8');
  }
  var fullFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/full.template.json'), 'utf8'));

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
  if (process.env.UPDATE) {
    fs.writeFileSync(path.join(__dirname,'./fixtures/sns.template.json'), JSON.stringify(snsBuilt, null, 2), 'utf8');
  }
  var snsFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/sns.template.json'), 'utf8'));

  t.deepEqual(snsBuilt,snsFixture, 'SNS rule build is equal to fixture');

  t.end();
});


tape('Compile Cloudwatch Event', function(t) {
  var eventConfig = {
    name: 'event',
    runtime: 'nodejs10.x',
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
  if (process.env.UPDATE) {
    fs.writeFileSync(path.join(__dirname,'./fixtures/event.template.json'), JSON.stringify(eventBuilt, null, 2), 'utf8');
  }
  var eventFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/event.template.json'), 'utf8'));

  t.deepEqual(eventBuilt,eventFixture, 'Event rule build is equal to fixture');

  t.end();
});

tape('Compile Scheduled function', function(t) {
  var scheduledConfig = {
    name: 'scheduled',
    runtime: 'nodejs10.x',
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
  if (process.env.UPDATE) {
    fs.writeFileSync(path.join(__dirname,'./fixtures/scheduled.template.json'), JSON.stringify(scheduledBuilt, null, 2), 'utf8');
  }
  var scheduledFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/scheduled.template.json'), 'utf8'));

  t.deepEqual(scheduledBuilt,scheduledFixture, 'Scheduled rule build is equal to fixture');

  t.end();
});


tape('Compile Hybrid Scheduled and Cloudwatch Event function ', function(t) {
  var hybridConfig = {
    name: 'hybrid',
    runtime: 'nodejs10.x',
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
  if (process.env.UPDATE) {
    fs.writeFileSync(path.join(__dirname,'./fixtures/hybrid.template.json'), JSON.stringify(hybridBuilt, null, 2), 'utf8');
  }
  var hybridFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/hybrid.template.json'), 'utf8'));

  t.deepLooseEqual(hybridBuilt, hybridFixture, 'Hybrid rule build is equal to fixture');

  t.end();
});

tape('Compile Webhook based function', function(t) {
  let gatewayConfig = {
    name: 'webhook',
    runtime: 'nodejs10.x',
    parameters: {
      'token': {
        'Type': 'String',
        'Description': 'token'
      }
    },
    gatewayRule: {
      method: 'POST',
      apiKey: true
    }
  };

  let gatewayBuilt = lambdaCfn.build(gatewayConfig);
  if (process.env.UPDATE) {
    fs.writeFileSync(path.join(__dirname,'./fixtures/gateway.template.json'), JSON.stringify(gatewayBuilt, null, 2), 'utf8');
  }

  const gatewayFixture = JSON.parse(fs.readFileSync(path.join(__dirname,'./fixtures/gateway.template.json'), 'utf8'));

  t.deepLooseEqual(gatewayBuilt, gatewayFixture, 'Gateway rule build is equal to fixture');
  t.end();
});
