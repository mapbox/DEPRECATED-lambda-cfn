const AWS = require('aws-sdk');

function publishMessage(msg, callback) {
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

function message(msg, callback) {
  if (process.env.NODE_ENV == 'test') {
    return callback(null, msg);
  }

  if (process.env.DispatchServiceSnsArn) {
    msg.topic = process.env.DispatchServiceSnsArn;
  } else if (!msg.topic) {
    msg.topic = process.env.ServiceAlarmSNSTopic;
  }

  publishMessage(msg, callback);
}

module.exports = message;