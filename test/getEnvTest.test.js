var path = require('path');
var tape = require('tape');
var lambdaCfn = require(process.cwd());

tape('Rule is loaded', function(t) {

  var m = { exports: {}};
  lambdaCfn.load(m, path.join(__dirname, 'cloudformation/lambda-getEnvTest.template.js'));

  t.equal(typeof m.exports['testgetEnvTest'], 'function', 'getEnvTest rule exported as function');
  var getEnvTest = m.exports['testgetEnvTest'];
  getEnvTest(null,function(err,data) {
    t.equal(data.testParameter1,'1','found namespaced parameter');
    t.equal(data.testParameter2,'2','found namespaced parameter');
    t.equal(data.testParameter3,'3','found namespaced parameter');
    t.end();
  });
});
