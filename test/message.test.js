const tape = require('tape');
const lambdaCfn = require('../index.js');
const AWS = require('@mapbox/mock-aws-sdk-js');
let test;

tape('setup SNS mock test harness', function(t) {
  if (process.env.NODE_ENV) {
    test = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
  }
  t.end();
});

tape('message default email address mapping', (t) => {
  process.env.ServiceAlarmSNSTopic = 'arn:aws:sns:us-east-1:012345678901:myTopic';
  const msg = {subject: 'test', event: 'test', summary: 'test'};
  const expected = { Subject: 'test', Message: 'test\n\n"test"', TopicArn: process.env.ServiceAlarmSNSTopic};
  const data = 'messageId';

  AWS.stub('SNS', 'publish', function(params, callback) {
    t.deepEqual(params, expected, 'uses default service alarm topic');
    callback(null, data);
  });

  lambdaCfn.message(msg, function(err, data) {
    t.ifError(err, 'success');
    t.equal(data, 'messageId');
    t.equal(AWS.SNS.callCount, 1, 'one SNS call ');
    AWS.SNS.restore();
    t.end();
  });
});

tape('message default email address mapping', (t) => {
  process.env.mySnsTopic = 'arn:aws:sns:us-east-1:012345678901:mySnsTopic';

  const msg = {subject: 'test', event: 'test', summary: 'test', topic: process.env.mySnsTopic};
  const expected = { Subject: 'test', Message: 'test\n\n"test"', TopicArn: process.env.mySnsTopic};
  const data = 'messageId';

  AWS.stub('SNS', 'publish', (params, callback) => {
    t.deepEqual(params, expected, 'uses custom topic');
    callback(null, data);
  });

  lambdaCfn.message(msg, function(err, data) {
    t.ifError(err, 'success');
    t.equal(data, 'messageId');
    t.equal(AWS.SNS.callCount, 1, 'one SNS call ');
    AWS.SNS.restore();
    t.end();
  });
});

tape('tear down SNS mock test harness', (t) => {
  process.env.NODE_ENV = test;
  t.end();
});
