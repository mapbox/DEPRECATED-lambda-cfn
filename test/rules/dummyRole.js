var message = require('../../').message;
var splitOnComma = require('../../').splitOnComma;

module.exports.config = {
  name: 'dummyRole',
  sourcePath: 'rules/dummyRole.js',
  parameters: {
    'blacklistedRoles': {
      'Type': 'String',
      'Description': 'Comma separated list of blacklisted roles',
    }
  },
  snsRule: {}
};

module.exports.fn = function(event, callback) {
};
