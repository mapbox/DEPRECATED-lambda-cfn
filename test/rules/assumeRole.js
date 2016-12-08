var message = require('../../').message;
var splitOnComma = require('../../').splitOnComma;

module.exports.config = {
  name: 'assumeRole',
  sourcePath: 'rules/assumeRole.js',
  runtime: 'nodejs',
  parameters: {
    'blacklistedRoles': {
      'Type': 'String',
      'Description': 'Comma separated list of blacklisted roles',
    }
  },
  eventRule: {
    eventPattern: {
      "detail-type": [
        "AWS API Call via CloudTrail"
      ],
      "detail": {
        "eventSource": [
          "sts.amazonaws.com"
        ],
        "eventName": [
          "AssumeRole"
        ]
      }
    }
  }
};

module.exports.fn = function(event, callback) {
  if (event.detail.errorCode)
    return callback(null, event.detail.errorMessage);
  var blacklisted = splitOnComma(process.env.blacklistedRoles);
  var assumedRoleArn = event.detail.requestParameters.roleArn;
  var userName = event.detail.userIdentity.userName;

  // Check for fuzzy match
  var match = blacklisted.filter(function(role) {
    return assumedRoleArn.indexOf(role) > -1;
  });

  if (match.length > 0) {
    var notif = {
      subject: 'Blacklisted role ' + match[0]  + ' assumed',
      summary: 'Blacklisted role ' + match[0]  + ' assumed by ' + userName,
      event: event
    };
    message(notif, function(err, result) {
      callback(err, result);
    });
  } else {
    callback(null, 'Blacklisted role was not assumed');
  }
};
