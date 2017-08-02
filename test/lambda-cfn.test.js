var tape = require('tape');
var lambdaCfn = require('../lib/lambda-cfn');


tape('buildFunctionTemplate unit tests', function(t) {
  t.throws(
    function() {
      lambdaCfn.buildFunctionTemplate(
        {}
      );
    }, /Function name is required/, 'Fail when no function name given'
  );

  var template = lambdaCfn.buildFunctionTemplate({
    name: 'test'
  });
  t.equal(template.AWSTemplateFormatVersion, '2010-09-09', 'Template format version');
  t.equal(template.Description, 'test lambda-cfn function', 'Template description');
  t.end();
});

tape('lambda unit tests', function(t) {
  var lambda = lambdaCfn.buildLambda;
  var def = lambda({name: 'myHandler'});
  t.equal(def.Resources.myHandler.Properties.Handler, 'function', 'Lambda handler correctly named');
  t.equal(def.Resources.myHandler.Properties.MemorySize, 128, 'Lambda memory size default correct');
  t.equal(def.Resources.myHandler.Properties.Timeout, 60, 'Lambda timeout default correct');
  def = lambda({name: 'myHandler', memorySize: 512, timeout: 300});
  t.equal(def.Resources.myHandler.Properties.MemorySize, 512, 'Lambda memory size updated');
  t.equal(def.Resources.myHandler.Properties.Timeout, 300, 'Lambda timeout updated');
  def = lambda({name: 'myHandler', memorySize: 512, timeout: 111});
  t.equal(def.Resources.myHandler.Properties.Timeout, 111, 'Lambda custom timeout correct');
  def = lambda({name: 'myHandler', memorySize: 512, timeout:-5});
  t.equal(def.Resources.myHandler.Properties.Timeout, 60, 'Negative timeout defaulted correctly');
  def = lambda({name: 'myHandler', memorySize: 4096, timeout: 600});
  t.equal(def.Resources.myHandler.Properties.MemorySize, 1536, 'Lambda memory size > 1536 safe default');
  t.equal(def.Resources.myHandler.Properties.Timeout, 300, 'Lambda timeout safe default');
  def = lambda({name: 'myHandler', memorySize: 1111, timeout: 600});
  t.equal(def.Resources.myHandler.Properties.MemorySize, 1088, 'Lambda memory size mod 64 safe default');
  def = lambda({name: 'myHandler', memorySize: 12, timeout: 600});
  t.equal(def.Resources.myHandler.Properties.MemorySize, 128, 'Lambda min memory size default');
  t.throws(
    function() {
      lambda({name: 'myHandler', runtime: 'nodejs'});
    }, /Invalid AWS Lambda node.js runtime/, 'Fail when bad nodejs runtime given'
  );
  def = lambda({name: 'myHandler', runtime: 'nodejs4.3'});
  t.equal(def.Resources.myHandler.Properties.Runtime, 'nodejs4.3', 'Created Node 4.3.2 runtime Lambda');
  def = lambda({name: 'myHandler'});
  t.equal(def.Resources.myHandler.Properties.Runtime, 'nodejs6.10', 'Default to Node 6.10 runtime if not specified');
  t.end();

});

tape('buildParameters unit tests', function(t) {
  var parameters = lambdaCfn.buildParameters;
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

  t.throws(
    function() {
      parameters({parameters: {'this_is_invalid': {
        Type: 'foo',
        Description: 'foo'
      }}});
    }, /Parameter names must be alphanumeric/, 'Fail on non-alphanumeric parameter names'
  );
  t.end();
});

tape('buildCloudWatchEvent unit tests', function(t) {
  var event = lambdaCfn.buildCloudwatchEvent;

  t.throws(
    function() {
      event({name: 'test'});
    }, /functionType property required for cloudwatch event/, 'Fail on no functionType'
  );

  t.throws(
    function() {
      event({name: 'test'}, 'badFunctionType');
    }, /unknown functionType property/, 'Fail on unknown functionType'
  );

  t.throws(
    function() {
      event({name: 'test',
             eventSources: {
               cloudwatchEvent: {
                 }}},
           'cloudwatchEvent');
    }, /eventPattern required for cloudwatch event/, 'Fail on no eventPattern'
  );

  t.throws(
    function() {
      event({name: 'test',
             eventSources: {
               schedule: {
               }}},
            'schedule');
    }, /scheduled function expression cannot/, 'Fail on no schedule expression'
  );

  var def = event({name: 'test',
                   eventSources: {
                     schedule: {
                       expression: 'rate(5 minutes)'
                     }}},
                  'schedule');
  t.looseEqual(Object.keys(def.Resources), ['testSchedulePermission','testScheduleRule'], 'event rule and permission named correctly');
  t.equal(def.Resources.testScheduleRule.Properties.ScheduleExpression, 'rate(5 minutes)', 'schedule expression found');

  def = event({name: 'test',
               eventSources: {
                 cloudwatchEvent: {
                   eventPattern: {
                     'detail-type': [],
                     detail: {}
                   }}}},
              'cloudwatchEvent');
  t.looseEqual(def.Resources.testCloudwatchEventRule.Properties.EventPattern, {'detail-type': [], detail: {}}, 'found event pattern');
  t.end();
});

tape('API Gateway function unit tests', function(t) {
  var webhookEvent = lambdaCfn.buildWebhookEvent;

  var def = { name: 'test', eventSources: { webhook: {}}};
  t.throws(
    function() {
      webhookEvent(def);
    }, /Webhook function method not found/, 'Fail with no HTTP method'
  );

  def = { name: 'test', eventSources: { webhook: { method: 'FAKE' }}};
  t.throws(
    function() {
      webhookEvent(def);
    }, /Invalid client HTTP method specified/, 'Fail with invalid client HTTP method'
  );

  def = { name: 'test', eventSources: { webhook: { method: 'POST', methodResponses: {}}}};
  t.throws(
    function() {
      webhookEvent(def);
    }, /Webhook method responses is not an array/, 'Fail with non-array method response'
  );

  def = { name: 'test', eventSources: { webhook: { method: 'POST', integrationResponses: {}}}};
  t.throws(
    function() {
      webhookEvent(def);
    }, /Webhook integration responses is not an array/, 'Fail with non-array method integration'
  );

  def = { name: 'test', eventSources: { webhook: { method: 'POST', apiKey: 'true'}}};
  var hook = webhookEvent(def);
  var r = hook.Resources.testWebhookResource;
  t.equal(r.Type,'AWS::ApiGateway::Resource');
  t.equal(r.Properties.RestApiId.Ref,'testWebhookApiGateway');
  t.equal(r.Properties.ParentId["Fn::GetAtt"][0],'testWebhookApiGateway');
  t.equal(r.Properties.ParentId["Fn::GetAtt"][1],'RootResourceId');
  t.equal(r.Properties.PathPart,'test');

  r = hook.Resources.testWebhookMethod;
  t.equal(r.Type,'AWS::ApiGateway::Method');
  t.equal(r.Properties.RestApiId.Ref,'testWebhookApiGateway');
  t.equal(r.Properties.ResourceId.Ref,'testWebhookResource');
  t.equal(r.Properties.AuthorizationType,'None');
  t.equal(r.Properties.HttpMethod,'POST');
  t.equal(r.Properties.Integration.Type,'AWS');
  t.equal(r.Properties.Integration.Uri["Fn::Join"][1][0], 'arn:aws:apigateway:');
  t.looseEqual(r.Properties.Integration.Uri["Fn::Join"][1][1], {Ref: "AWS::Region"});
  t.equal(r.Properties.Integration.Uri["Fn::Join"][1][2], ':lambda:path/2015-03-31/functions/');
  t.looseEqual(r.Properties.Integration.Uri["Fn::Join"][1][3], {"Fn::GetAtt":["test","Arn"]});
  t.equal(r.Properties.Integration.Uri["Fn::Join"][1][4], '/invocations');
  t.equal(r.Properties.ApiKeyRequired,'true');

  r = hook.Resources.testWebhookApiGateway;
  t.equal(r.Type, 'AWS::ApiGateway::RestApi','Found RestAPI resource type');
  t.equal(r.Properties.Name.Ref,'AWS::StackName','RestAPI set to stack name');

  r = hook.Resources.testWebhookApiDeployment;
  t.equal(r.Type, 'AWS::ApiGateway::Deployment','Found API deployment resource type');
  t.equal(r.Properties.RestApiId.Ref,'testWebhookApiGateway','Deployment points to RestAPI');

  r = hook.Resources.testWebhookApiKey;
  t.equal(r.Type, 'AWS::ApiGateway::ApiKey','Found API Key resource type');
  t.equal(r.Properties.Name.Ref,'AWS::StackName', 'References stackName');
  t.equal(r.DependsOn,'testWebhookApiDeployment');
  t.equal(r.Properties.Enabled,'true');
  t.equal(r.Properties.StageKeys[0].RestApiId.Ref,'testWebhookApiGateway');
  t.equal(r.Properties.StageKeys[0].StageName,'prod');

  r = hook.Resources.testWebhookApiLatencyAlarm;
  t.equal(r.Type, 'AWS::CloudWatch::Alarm');
  t.equal(r.Properties.AlarmActions.Ref, 'LambdaCfnAlarmSNSTopic');

  r = hook.Resources.testWebhookApi4xxAlarm;
  t.equal(r.Type, 'AWS::CloudWatch::Alarm');
  t.equal(r.Properties.AlarmActions.Ref, 'LambdaCfnAlarmSNSTopic');

  r = hook.Resources.testWebhookApiCountAlarm;
  t.equal(r.Type, 'AWS::CloudWatch::Alarm');
  t.equal(r.Properties.AlarmActions.Ref, 'LambdaCfnAlarmSNSTopic');

  r = hook.Resources.testWebhookPermission;
  t.equal(r.Type, 'AWS::Lambda::Permission');
  t.equal(r.Properties.FunctionName['Fn::GetAtt'][0], 'test');

  t.equal(hook.Outputs.testWebhookApiKey.Ref,'testWebhookApiKey');
  t.end();
});


tape('buildSnsEvent unit tests', function(t) {
  var sns = lambdaCfn.buildSnsEvent;
  var def = sns({ name: 'test' });
  t.equal(def.Resources.testSNSPermission.Type,'AWS::Lambda::Permission');
  t.equal(def.Resources.testSNSPermission.Properties.FunctionName['Fn::GetAtt'][0],'test');
  t.equal(def.Resources.testSNSPermission.Properties.SourceArn.Ref, 'testSNSTopic');

  t.equal(def.Resources.testSNSUser.Type,'AWS::IAM::User');
  t.equal(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[0].Resource.Ref,'testSNSTopic');
  t.deepEqual(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[0].Action,
              ['sns:ListTopics','sns:Publish'],
              'Policy actions set correctly');
  t.equal(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[0].Effect,'Allow','Policy Effect set');
  t.equal(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[1].Resource['Fn::Join'][1][4],':*','List Account Topics policy set');
  t.deepEqual(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[1].Action,
              ['sns:ListTopics'],
              'List Account Topics action set');
  t.equal(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[1].Effect,'Allow','List Account Topics effect set');

  t.equal(def.Resources.testSNSTopic.Type, 'AWS::SNS::Topic');
  t.equal(def.Resources.testSNSTopic.Properties.DisplayName['Fn::Join'][1][1],'test');
  t.equal(def.Resources.testSNSTopic.Properties.TopicName['Fn::Join'][1][1],'test');
  t.equal(def.Resources.testSNSTopic.Properties.Subscription[0].Protocol,'lambda','Subcription protocol set correctly');
  t.equal(def.Resources.testSNSTopic.Properties.Subscription[0].Endpoint["Fn::GetAtt"][0],'test','Subcription endpoint set correctly');

  t.equal(def.Resources.testSNSUserAccessKey.Properties.UserName.Ref,'testSNSUser');


  t.equal(def.Outputs.testSNSTopic.Value.Ref,'testSNSTopic');
  t.equal(def.Outputs.testSNSUserAccessKey.Value.Ref,'testSNSUserAccessKey');
  t.equal(def.Outputs.testSNSUserSecretAccessKey.Value['Fn::GetAtt'][0],'testSNSUserAccessKey');
  t.equal(def.Outputs.testSNSUserSecretAccessKey.Value['Fn::GetAtt'][1],'SecretAccessKey');
  t.end();
});

tape('buildRole unit tests', function(t) {
  var role = lambdaCfn.buildRole;
  t.throws(
    function() {
      role({statements: {}});
    }, /options.statements must be an array/, 'Fail when statements not an array'
  );

  t.throws(
    function() {
      role({statements: [{}]});
    }, /statement must contain Effect/, 'Fail when statement has no Effect'
  );

  t.throws(
    function() {
      role({statements: [ {Effect: 'test'}]});
    }, /statement must contain Resource or NotResource/, 'Fail when statement has no Resource or NotResource'
  );

  t.throws(
    function() {
      role({statements: [ {Effect: 'test', Resource: {}}]});
    }, /statement must contain Action or NotAction/, 'Fail when statement has no Action or NotAction'
  );

  var myPolicy;

  t.doesNotThrow(
    function() {
      myPolicy = role({
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
//  t.comment(JSON.stringify(myPolicy));
  t.equal(myPolicy.Resources.LambdaCfnRole.Properties.Policies[1].PolicyName, 'myLambda');
  t.deepEqual(myPolicy.Resources.LambdaCfnRole.Properties.Policies[1], {
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

tape('envVariableParser unit tests', function(t) {

    var onlyGlobalEnvVariables = {};

    t.doesNotThrow(
        function() {
            onlyGlobalEnvVariables = envVariableParser({});
        }, null, 'Does not throw if no parameters');

    t.deepEqual(onlyGlobalEnvVariables,
        {
            "AccountName": {"Ref": "AWS::AccountId"},
            "LambdaCfnAlarmSNSTopic": {"Ref": "LambdaCfnAlarmSNSTopic"},
            "Region": {"Ref": "AWS::Region"},
            "StackId": {"Ref": "AWS::StackId"},
            "StackName": {"Ref": "AWS::StackName"}
        },
        'Only global env variables if no parameters');

    var validEnvVariables = envVariableParser({
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

    t.deepEqual(validEnvVariables,
        {
            "myFunctionparam1": {"Ref": "myFunctionparam1"},
            "myFunctionparam2": {"Ref": "myFunctionparam2"},
            "AccountName": {"Ref": "AWS::AccountId"},
            "LambdaCfnAlarmSNSTopic": {"Ref": "LambdaCfnAlarmSNSTopic"},
            "Region": {"Ref": "AWS::Region"},
            "StackId": {"Ref": "AWS::StackId"},
            "StackName": {"Ref": "AWS::StackName"}
        },
        'Global plus function env variables set');

    t.end();
});
