var lambdaCfn = require('../../');

module.exports = lambdaCfn(
  [
    'test/rules/getEnvTest.js'
  ],
  {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Description": "patrol"
  }
);
