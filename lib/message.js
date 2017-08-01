var AWS = require('aws-sdk');

module.exports = message;
function message(msg, callback) {
  if (process.env.NODE_ENV == 'test') {
    return callback(null, msg);
  }

  if (!msg.topic) {
    msg.topic = process.env.ServiceAlarmSNSTopic;
  }
  var sns = new AWS.SNS();
  var params = {
    Subject: msg.subject,
    Message:
    msg.summary + '\n\n' +
      JSON.stringify(msg.event, null, 2),
    TopicArn: msg.topic
  };
  sns.publish(params, function(err, data) {
    return callback(err, data);
  });
};
