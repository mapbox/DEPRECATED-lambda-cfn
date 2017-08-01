var tape = require('tape');
var lambdaCfn = require('../index.js');
var AWS = require('@mapbox/mock-aws-sdk-js');
var test;

tape('setup SNS mock test harness', function(t) {
  if (process.env.NODE_ENV) {
    test = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
  }
  t.end();
});

tape('message default email address mapping', function(t) {
  process.env.ServiceAlarmSNSTopic = 'arn:aws:sns:us-east-1:012345678901:myTopic';
  var msg = {subject: 'test', event: 'test', summary: 'test'};
  var expected = { Subject: 'test', Message: 'test\n\n"test"', TopicArn: process.env.ServiceAlarmSNSTopic };
  var data = 'messageId';

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

tape('message default email address mapping', function(t) {
  process.env.mySnsTopic = 'arn:aws:sns:us-east-1:012345678901:mySnsTopic';
  var msg = {subject: 'test', event: 'test', summary: 'test', topic: process.env.mySnsTopic };
  var expected = { Subject: 'test', Message: 'test\n\n"test"', TopicArn: process.env.mySnsTopic };
  var data = 'messageId';
  AWS.stub('SNS', 'publish', function(params, callback) {
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


tape('tear down SNS mock test harness', function(t) {
  process.env.NODE_ENV = test;
  t.end();
});
