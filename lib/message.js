var AWS = require('aws-sdk');

module.exports = function(message, callback) {

  if (process.env.NODE_ENV == 'test') {
    callback(null, message);
  } else {
    var sns = new AWS.SNS();
    var params = {
      Subject: message.subject,
      Message:
        message.summary + "\n\n" +
        JSON.stringify(message.event, null, 2),
      TopicArn: process.env.LambdaCfnAlarmSNSTopic
    };
    sns.publish(params, function(err, data) {
      callback(err, data);
    });
  }

};
