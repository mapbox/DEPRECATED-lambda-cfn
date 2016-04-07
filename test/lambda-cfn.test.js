var tape = require('tape');
var lambdaCfn = require('../lib/lambda-cfn');

var parameters = lambdaCfn.parameters;
var lambda = lambdaCfn.lambda;
var lambdaPermission = lambdaCfn.lambdaPermission;
var policy = lambdaCfn.policy;
var streambotEnv = lambdaCfn.streambotEnv;
var cloudwatch = lambdaCfn.cloudwatch;
var splitOnComma = lambdaCfn.splitOnComma;
var lambdaSnsTopic = lambdaCfn.lambdaSnsTopic;
var lambdaSnsUser = lambdaCfn.lambdaSnsUser;
var lambdaSnsUserAccessKey = lambdaCfn.lambdaSnsUserAccessKey;
var outputs = lambdaCfn.outputs;

tape('parameter unit tests', function(t) {
  t.throws(
    function() {
      parameters({parameters: {a: {
        Description: 'foo'
      }}});
    }, /must contain Type property/, 'Fail when parameter lacks Type property'

  );

  t.throws(
    function() {
      parameters({parameters: {a: {
        Type: 'foo'
      }}});
    }, /must contain Description property/, 'Fail when parameter lacks Description property'

  );

  t.end();

});

tape('lambda unit tests', function(t) {

  t.throws(
    function() {
      lambda({});
    }, /name property required/, 'Fail when no name property'

  );
  var def = lambda({name: 'myHandler'});
  t.equal(def.Properties.Handler, 'index.myHandler', 'Lambda handler correctly named');
  t.equal(def.Properties.MemorySize, 128, 'Lambda memory size default correct');
  t.equal(def.Properties.Timeout, 60, 'Lambda timeout default correct');
  def = lambda({name: 'myHandler', memorySize: 512, timeout: 300});
  t.equal(def.Properties.MemorySize, 512, 'Lambda memory size updated');
  t.equal(def.Properties.Timeout, 300, 'Lambda timeout updated');
  def = lambda({name: 'myHandler', memorySize: 4096, timeout: 600});
  t.equal(def.Properties.MemorySize, 128, 'Lambda memory size > 1536 safe default');
  t.equal(def.Properties.Timeout, 60, 'Lambda timeout safe default');
  def = lambda({name: 'myHandler', memorySize: 1111, timeout: 600});
  t.equal(def.Properties.MemorySize, 128, 'Lambda memory size mod 64 safe default');

  t.end();

});

tape('lambda permission unit tests', function(t) {

  t.throws(
    function() {
      lambda({});
    }, /name property required/, 'Fail when no name property'

  );

  var def = lambdaPermission({name: 'myHandler', eventRule: {}});
  t.equal(def.Properties.FunctionName["Fn::GetAtt"][0], 'myHandler', 'Lambda handler correctly named');
  t.end();

});

tape('policy unit tests', function(t) {
  var noPolicy = policy({});
  t.equal(noPolicy, undefined);

  t.throws(
    function() {
      policy({
        statements: []
      });
    }, /name property required for policy/, 'Fail in policy when no name property'

  );

  t.throws(
    function() {
      policy({
        name: 'myLambda',
        statements: 'myString'
      });
    }, /must be an array/, 'Fail when statements is not an array'

  );

  t.throws(
    function() {
      policy({
        name: 'myLambda',
        statements: [
          {
            "Action": [
              "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::mySuperDuperBucket"
          }
        ]
      });
    }, /statement must contain Effect/, 'Fail when statement contains no Effect'

  );

  t.throws(
    function() {
      policy({
        name: 'myLambda',
        statements: [
          {
            "Effect": "Allow",
            "Resource": "arn:aws:s3:::mySuperDuperBucket"
          }
        ]
      });
    }, /statement must contain Action or NotAction/,
      'Fail when statement does not contain Action or NotAction');

  t.throws(
    function() {
      policy({
        name: 'myLambda',
        statements: [
          {
            "Effect": "Allow",
            "Action": [
              "s3:GetObject"
            ]
          }
        ]
      });
    }, /statement must contain Resource or NotResource/,
      'Fail when statement does not contain Resource or NotResource');

  var myPolicy;

  t.doesNotThrow(
    function() {
      myPolicy = policy({
        name: 'myLambda',
        statements: [
          {
            "Effect": "Allow",
            "Action": [
              "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::mySuperDuperBucket"
          },
          {
            "Effect": "Allow",
            "NotAction": [
              "s3:GetObject"
            ],
            "NotResource": "arn:aws:s3:::mySuperDuperBucket"
          }
        ]
      });
    });

  t.equal(myPolicy.PolicyName, 'myLambda');
  t.deepEqual(myPolicy, {
    PolicyName: 'myLambda',
    PolicyDocument: {
      Statement: [
        {
          "Effect": "Allow",
          "Action": [
            "s3:GetObject"
          ],
          "Resource": "arn:aws:s3:::mySuperDuperBucket"
        },
        {
          "Effect": "Allow",
          "NotAction": [
            "s3:GetObject"
          ],
          "NotResource": "arn:aws:s3:::mySuperDuperBucket"
        }
      ]
    }
  });

  t.end();

});

tape('streambotEnv unit tests', function(t) {
  t.throws(
    function() {
      streambotEnv({});
    }, /name property required for streambotEnv/,
      'Fail in streambotEnv when no name property'

  );

  var onlyGlobalStreambotEnv;

  t.doesNotThrow(
    function() {
      onlyGlobalStreambotEnv = streambotEnv({name: 'myFunction'});
    }, null, 'Does not throw if no parameters');

  t.deepEqual(onlyGlobalStreambotEnv, {
      "Type": "Custom::StreambotEnv",
      "Properties": {
        "ServiceToken": {
          "Ref": "StreambotEnv"
        },
        "FunctionName": {
          "Ref": "myFunction"
        },
        "LambdaCfnAlarmSNSTopic": {
          "Ref": "LambdaCfnAlarmSNSTopic"
        }
      }
    }, 'Only global streambotEnv if no parameters');

  var validStreambotEnv = streambotEnv({
    name: 'myFunction',
    parameters: {
      param1: {
        Type: 'String',
        Description: 'desc 1'
      },
      param2: {
        Type: 'String',
        Description: 'desc 2'
      }
    }
  });

  t.deepEqual(validStreambotEnv, {
      "Type": "Custom::StreambotEnv",
      "Properties": {
        "ServiceToken": {
          "Ref": "StreambotEnv"
        },
        "FunctionName": {
          "Ref": "myFunction"
        },
        "param1": {
          "Ref": "param1"
        },
        "param2": {
          "Ref": "param2"
        },
        "LambdaCfnAlarmSNSTopic": {
          "Ref": "LambdaCfnAlarmSNSTopic"
        }
      }
    }
  );

  t.end();
});

tape('cloudwatch unit tests', function(t) {
  t.throws(
    function() {
      cloudwatch({});
    }, '/name property required/', 'Fail when no name property'
  );

  var alarms = cloudwatch({name: 'myFunction'});
  t.notEqual(alarms.myFunctionAlarmErrors, undefined, 'Errors alarm is set');
  t.notEqual(alarms.myFunctionAlarmNoInvocations, undefined, 'NoInvocations alarm is set');
  t.equal(
    alarms.myFunctionAlarmErrors.Properties.ComparisonOperator,
    'GreaterThanThreshold', 'Uses correct comparison');
  t.equal(
    alarms.myFunctionAlarmNoInvocations.Properties.ComparisonOperator,
    'LessThanThreshold', 'Uses correct comparison');
  t.equal(
    alarms.myFunctionAlarmErrors.Properties.MetricName,
    'Errors', 'Uses correct metric name');
  t.equal(
    alarms.myFunctionAlarmNoInvocations.Properties.MetricName,
    'Invocations', 'Uses correct metric name');

  t.end();

});

tape('splitOnComma unit tests', function(t) {

  t.deepEqual(
    splitOnComma('foo, bar'),
    ['foo', 'bar'],
    'split string with comma'
  );

  t.deepEqual(
    splitOnComma('foo'),
    ['foo'],
    'split string with no comma'
  );

  t.deepEqual(
    splitOnComma('foo,bar'),
    ['foo', 'bar'],
    'split string with comma and no space'
  );

  t.end();
});

tape('lambdaSnsTopic unit tests', function(t) {

  t.throws(
    function() {
      lambda({});
    }, /name property required/, 'Fail when no name property'

  );

  var def = lambdaSnsTopic({name: 'myHandler'});
  t.equal(def.Type, 'AWS::SNS::Topic', 'Lambda SNS topic type correct');
  t.ok(def.Properties.TopicName,'TopicName present');
  t.equal(def.Properties.DisplayName["Fn::Join"][1][1],'myHandler','DisplayName set correctly');
  t.equal(def.Properties.TopicName["Fn::Join"][1][1],'myHandler','TopicName set correctly');
  t.equal(def.Properties.Subscription[0].Protocol,'lambda','Subcription protocol set correctly');
  t.equal(def.Properties.Subscription[0].Endpoint["Fn::GetAtt"][0],'myHandler','Subcription endpoint set correctly');
  t.end();
});

tape('lambdaSnsUser unit tests', function(t) {

  t.throws(
    function() {
      lambda({});
    }, /name property required/, 'Fail when no name property'

  );

  var def = lambdaSnsUser({name: 'myHandler'});
  t.equal(def.Type,'AWS::IAM::User','Lambda SNS user type correct');
  t.equal(def.Properties.Policies[0].PolicyName,'myHandlerSNSTopicPolicy','PolicyName set correctly');
  t.equal(def.Properties.Policies[0].PolicyDocument.Statement[0].Resource[0].Ref,'myHandlerSNSTopic','Policy resource name set correctly');
  t.deepEqual(def.Properties.Policies[0].PolicyDocument.Statement[0].Action,
              ['sns:ListTopics','sns:Publish'],
              'Policy actions set correctly');
  t.equal(def.Properties.Policies[0].PolicyDocument.Statement[0].Effect,'Allow','Policy Effect set');
  t.equal(def.Properties.Policies[0].PolicyDocument.Statement[1].Resource[0]["Fn::Join"][1][4],':*','List Account Topics policy set');
  t.deepEqual(def.Properties.Policies[0].PolicyDocument.Statement[1].Action,
              ['sns:ListTopics'],
              'List Account Topics action set');
  t.equal(def.Properties.Policies[0].PolicyDocument.Statement[1].Effect,'Allow','List Account Topics effect set');
  t.end();
});

tape('lambdaSnsUserAccessKey unit tests', function(t) {

  t.throws(
    function() {
      lambda({});
    }, /name property required/, 'Fail when no name property'

  );

  var def = lambdaSnsUserAccessKey({name: 'myHandler'});
  t.equal(def.Type,'AWS::IAM::AccessKey','Key type set');
  t.equal(def.Properties.UserName.Ref,'myHandlerSNSUser','Key name set');
  t.end();
});

tape('template outputs unit tests', function(t) {

  t.throws(
    function() {
      lambda({});
    }, /name property required/, 'Fail when no name property'

  );

  var def = outputs({name: 'myHandler'});
  t.equal(def,undefined,'non-snsRules have no outputs');
  def = outputs({name: 'myHandler',snsRule:{}});
  t.equal(def.myHandlerSNSTopic.Value.Ref,'myHandlerSNSTopic','SNS topic output is set');
  t.equal(def.myHandlerSNSUserAccessKey.Value.Ref,'myHandlerSNSUserAccessKey','User access key output is set');
  t.equal(def.myHandlerSNSUserSecretAccessKey.Value["Fn::GetAtt"][0],'myHandlerSNSUserAccessKey','User secret access key output is set');
  t.end();
});
