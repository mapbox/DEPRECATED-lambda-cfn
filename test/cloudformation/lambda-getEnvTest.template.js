var lambdaCfn = require(process.cwd());

module.exports = lambdaCfn(
  [
    'test/patrol-rules-diagnostic/rules/getEnvTest.js'
  ],
  {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Description": "patrol"
  }
);
