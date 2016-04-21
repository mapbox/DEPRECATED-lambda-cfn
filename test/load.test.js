var path = require('path');
var tape = require('tape');
var lambdaCfn = require(process.cwd());


tape('Rule is loaded', function(t) {
  var m = { exports: {}};
  lambdaCfn.load(m, path.join(__dirname, 'cloudformation/lambda-cfn-tests.template.js'));

  t.equal(typeof m.exports['test-assumeRole'], 'function', 'assumeRole rule exported as function');
  var m = { exports: {}};
  t.throws(
    function() {
      lambdaCfn.load(m);
    }, '/no such file/', 'Cannot find missing cloudformation directory');

  t.end();

});
