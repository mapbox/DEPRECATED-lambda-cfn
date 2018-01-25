const AWS = require('aws-sdk');

function publishPatrolMessage(msg, callback) {
  const sns = new AWS.SNS();
  let params = {
    Subject: msg.subject,
    Message: msg.summary + '\n\n' + JSON.stringify(msg.event, null, 2),
    TopicArn: msg.topic
  };

  sns.publish(params, function(err, data) {
    return callback(err, data);
  });
}

function publishDispatchMessage(msg, callback) {
  const sns = new AWS.SNS();
  const params = {
    Message: JSON.stringify(msg),
    TopicArn: msg.topic
  };

  sns.publish(params, function(err, data) {
    if (err) return callback(err);
    return callback(null, data);
  });
}

function message(msg, callback) {
  if (process.env.NODE_ENV === 'test') {
    return callback(null, msg);
  }

  if (process.env.DispatchSnsArn) {
    msg.topic = process.env.DispatchSnsArn;
    return publishDispatchMessage(msg, callback);
  }

  if (!msg.topic) {
    msg.topic = process.env.ServiceAlarmSNSTopic;
  }

  publishPatrolMessage(msg, callback);
}

module.exports = message;