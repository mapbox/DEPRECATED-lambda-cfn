var fs = require('fs');
var path = require('path');
var tape = require('tape');
var lambdaCfn = require('../lib/lambda-cfn');

tape('Compile unit tests', function(t) {

  t.throws(
    function() {
      lambdaCfn.compile('foo');
    }, '/must be an array/', 'compile takes array first parameter');

  var simpleBuilt = lambdaCfn.compile([lambdaCfn.build({
    name: 'simple',
    sourcePath: 'rules/myRule.js'
  })], {});

  var simpleFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/simple.template'), "utf8"));
  t.deepEqual(simpleBuilt, simpleFixture, 'simple build is equal to fixture');

  var fullConfig = {
    name: 'full',
    sourcePath: 'rules/myRule.js',
    parameters: {
      'githubToken': {
        'Type': 'String',
        'Description': 'Github API token with users scope',
      },
      'myBucket': {
        'Type': 'String',
        'Description': 'Bucket where to store'
      }
    },
    statements: [
      {
        "Effect": "Allow",
        "Action": [
          "s3:GetObject"
        ],
        "Resource": "arn:aws:s3:::mySuperDuperBucket"
      }
    ]
  };

  var fullBuilt = lambdaCfn.compile([lambdaCfn.build(fullConfig)], {});
  console.log(JSON.stringify(fullBuilt));
  var fullFixture = JSON.parse(fs.readFileSync(path.join(__dirname, './fixtures/full.template'), "utf8"));

  t.deepEqual(fullBuilt, fullFixture, 'full build is equal to fixture');

  t.end();

});
