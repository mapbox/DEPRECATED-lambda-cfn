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
var cweRules = lambdaCfn.cweRules;
var apiGateway = lambdaCfn.apiGateway;
var apiDeployment = lambdaCfn.apiDeployment;
var apiKey = lambdaCfn.apiKey;
var gatewayRules = lambdaCfn.gatewayRules;

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
  var def = {name: 'invalid_char&^#--In!@Name', parameters:  {a: { Type: 'foo',Description: 'foo'}}};
  var r  = parameters(def);
  t.looseEqual(r,{invalidcharInNamea: {Description: 'foo',Type: 'foo'}},'Strips function name and generates namespace');
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
  def = lambda({name: 'myHandler', runtime: 'nodejs'});
  t.equal(def.Properties.Runtime, 'nodejs', 'Created Node 0.10 runtime Lambda');
  def = lambda({name: 'myHandler', runtime: 'nodejs4.3'});
  t.equal(def.Properties.Runtime, 'nodejs4.3', 'Created Node 4.3.2 runtime Lambda');
  def = lambda({name: 'myHandler'});
  t.equal(def.Properties.Runtime, 'nodejs4.3', 'Default to Node 4.3.2 runtime if not specified');

  t.throws(
    function() {
      lambda({name: 'myHandler', runtime: 'foobarbaz'});
    }, /Invalid AWS Lambda node.js runtime foobarbaz/, 'Fails with invalid runtime'
  );

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
        "myFunctionparam1": {
          "Ref": "myFunctionparam1"
        },
        "myFunctionparam2": {
          "Ref": "myFunctionparam2"
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

tape('CloudWatch Event rules unit tests', function(t) {
  var eventDef = {
    name: 'myHandler'
  };
  var eventRes;

  t.throws(
    function() {
      cweRules({});
    }, /name property required for cweRules/, 'Fail when no name property'
  );

  t.throws(
    function() {
      cweRules(eventDef);
    }, /ruleType property required for cweRules/, 'Fail when no ruleType property'
  );

  t.throws(
    function() {
      cweRules(eventDef,'asdf');
    }, /unknown ruleType property/, 'Fail when ruleType property unknown'
  );

  eventDef.eventRule = {};

  t.throws(
    function() {
      cweRules(eventDef,'eventRule');
    }, /eventPattern required for eventRule/, 'Fail when eventPattern not specified for eventRule'
  );

  t.throws(
    function() {
      cweRules(eventDef,'scheduledRule');
    }, /scheduled rule expression cannot be undefined/, 'Fail when scheduled rule expression is undefined'
  );

  eventDef.eventRule.eventPattern = {
    test: 'test'
  };

  var eventPat = {
    test: 'test'
  };
  eventRes = (cweRules(eventDef,'eventRule'));
  t.equal(eventRes.Type, 'AWS::Events::Rule');
  t.deepLooseEqual(eventRes.Properties.EventPattern, eventPat,'EventPattern found');

  eventDef.scheduledRule = 'rate(5 minutes)';
  eventRes = (cweRules(eventDef,'scheduledRule'));
    t.equal(eventRes.Properties.ScheduleExpression,'rate(5 minutes)','ScheduleExpression found');
  t.end();
});

tape('apiGateway template stub unit tests', function(t) {
  var g = apiGateway();
  t.equal(g.Type, 'AWS::ApiGateway::RestApi','Found RestAPI resource type');
  t.equal(g.Properties.Name.Ref,'AWS::StackName','RestAPI set to stack name');
  t.end();
});

tape('apiDeployment template stub unit tests', function(t) {
  var d = apiDeployment();
  t.equal(d.Type, 'AWS::ApiGateway::Deployment','Found API deployment resource type');
  t.equal(d.Properties.RestApiId.Ref,'ApiGateway','Deployment points to RestAPI');
  t.end();
});

tape('apiKey template stub unit tests', function(t) {
  var k = apiKey();
  t.equal(k.Type, 'AWS::ApiGateway::ApiKey','Found API Key resource type');
  t.equal(k.Properties.Name.Ref,'AWS::StackName');
  t.deepLooseEqual(k.DependsOn,'ApiDeployment');
  t.equal(k.Properties.Enabled,'true');
  t.equal(k.Properties.StageKeys[0].RestApiId.Ref,'ApiGateway');
  t.equal(k.Properties.StageKeys[0].StageName,'prod');
  t.end();
});

tape('Gateway rule unit tests', function(t) {
  t.throws(
    function() {
      gatewayRules({});
    }, /name property required/, 'Fail when no name property'
  );
  var def = {name: 'myHandler'};
  t.throws(
    function() {
      gatewayRules(def);
    }, /resource type required for gateway rule template/, 'Fail when resource type not specified'
  );
  t.throws(
    function() {
      gatewayRules(def,'fakefake');
    }, /Invalid api gateway resource type/, 'Fail with invalid resource type'
  );

  def.gatewayRule = {};
  def.gatewayRule.method = 'FAKE';
  t.throws(
    function() {
      gatewayRules(def,'method');
    }, /Invalid client HTTP method specified/, 'Fail with invalid client HTTP method'
  );

  def.gatewayRule.method = 'post';
  var r = gatewayRules(def,'resource');
  t.equal(r.Type,'AWS::ApiGateway::Resource');
  t.equal(r.Properties.RestApiId.Ref,'ApiGateway');
  t.equal(r.Properties.ParentId["Fn::GetAtt"][0],'ApiGateway');
  t.equal(r.Properties.ParentId["Fn::GetAtt"][1],'RootResourceId');
  t.equal(r.Properties.PathPart,'myhandler');
  r = gatewayRules(def,'method');
  t.equal(r.Type,'AWS::ApiGateway::Method');
  t.equal(r.Properties.RestApiId.Ref,'ApiGateway');
  t.equal(r.Properties.ResourceId.Ref,'myHandlerGatewayRuleResource');
  t.equal(r.Properties.AuthorizationType,'None');
  t.equal(r.Properties.HttpMethod,'POST');
  t.equal(r.Properties.Integration.Type,'AWS');
  t.equal(r.Properties.Integration.Uri["Fn::Join"][1][0], 'arn:aws:apigateway:');
  t.looseEqual(r.Properties.Integration.Uri["Fn::Join"][1][1], {Ref: "AWS::Region"});
  t.equal(r.Properties.Integration.Uri["Fn::Join"][1][2], ':lambda:path/2015-03-31/functions/');
  t.looseEqual(r.Properties.Integration.Uri["Fn::Join"][1][3], {"Fn::GetAtt":["myHandler","Arn"]});
  t.equal(r.Properties.Integration.Uri["Fn::Join"][1][4], '/invocations');


  def.gatewayRule.apiKey = true;
  r = gatewayRules(def,'method');
  t.equal(r.Properties.ApiKeyRequired,'true');

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
  t.looseEqual(def,{},'non-snsRules have empty output');
  def = outputs({name: 'myHandler',snsRule:{}});
  t.equal(def.myHandlerSNSTopic.Value.Ref,'myHandlerSNSTopic','SNS topic output is set');
  t.equal(def.myHandlerSNSUserAccessKey.Value.Ref,'myHandlerSNSUserAccessKey','User access key output is set');
  t.equal(def.myHandlerSNSUserSecretAccessKey.Value["Fn::GetAtt"][0],'myHandlerSNSUserAccessKey','User secret access key output is set');
  def = outputs({name: 'myHandler',gatewayRule:{}});
  t.looseEqual(def.myHandlerAPIEndpoint.Value["Fn::Join"][1][1],{Ref: "ApiGateway"});
  t.equal(def.myHandlerAPIEndpoint.Value["Fn::Join"][1][2],".execute-api.");
  t.looseEqual(def.myHandlerAPIEndpoint.Value["Fn::Join"][1][3],{Ref: "AWS::Region"});
  t.equal(def.myHandlerAPIEndpoint.Value["Fn::Join"][1][4],".amazonaws.com/prod/");
  t.looseEqual(def.myHandlerAPIEndpoint.Value["Fn::Join"][1][5],"myhandler");
  t.end();
});
