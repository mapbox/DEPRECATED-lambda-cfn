var tape = require('tape');
var lambdaCfn = require('../index.js');

tape('buildFunctionTemplate unit tests', function(t) {
  var template = lambdaCfn.build.buildFunctionTemplate;
  var def = template({name: 'test'});
  t.equal(def.AWSTemplateFormatVersion, '2010-09-09', 'Template format version');
  t.equal(def.Description, 'test lambda-cfn function', 'Template description');
  t.end();
});

tape('compileFunction unit tests', function(t) {
  var compile = lambdaCfn.build.compileFunction;
  var m1 = {};
  var m2 = {};
  var testSet = ['Metadata','Parameters','Mappings','Conditions','Resources','Outputs','Variables' ];

  testSet.map(function(m) {
    m1[m] = { m1: {} };
    m2[m] = { m1: {} };
    t.throws(
      function() {
        compile(m1, m2);
      }, /name used more than once/, 'Fail when duplicate ' + m + ' objects');
  });

  var p1 = { Policies: [{a:'b'},{c:'d'}]};
  var p2 = { Policies: [{e:'f'},{g:'h'}]};
  var def = compile(p1,p2);
  t.looseEqual(def.Policies,[{a:'b'},{c:'d'},{e:'f'},{g:'h'}], 'Policies array created correctly');

  p1 = { Policies: []};
  p2 = { Policies: {}};
  def = compile(p1,p2);
  t.equal(def.Policies,undefined, 'Empty Policies skipped');
  t.end();
});

tape('buildFunction unit tests', function(t) {
  var lambda = lambdaCfn.build.buildFunction;
  t.throws(
    function() { lambda({}); }, /Function name is required/, 'Fail when no function name given'
  );
  var def = lambda({name: 'test'});
  t.ok(def.Resources.testSNSPermission,'default SNS event function');
  t.ok(def.Resources.testSNSUser,'default SNS event function');
  t.ok(def.Resources.testSNSTopic,'default SNS event function');
  t.ok(def.Resources.testSNSUserAccessKey,'default SNS event function');
  t.ok(def.Outputs.testSNSTopic,'default SNS event function');

  t.throws(function() {
    lambda({name: 'test', eventSources: { bad: {}}});
  }, /Unknown event source specified: bad/, 'Fail on unknown event source');

  t.throws(function() {
    lambda({name: 'test', destinations: { bad: {}}});
  }, /Unknown destination specified: bad/, 'Fail on unknown destination');

  var i = 0;
  var parameters = {};
  while (i < 61) {
    parameters['p' + i] = { Type:'a', Description: 'b'};
    i++;
  };
  t.throws(function() {
    lambda({name: 'test', parameters: parameters });
  }, /More than 60 parameters specified/, 'Fail on >60 parameters');

  def = lambda({name: 'test'});
  t.equal(def.Policies, undefined, 'Non CFN field Policies removed');
  t.equal(def.Variables, undefined, 'Non CFN field Variables removed');

  t.end();
});

tape('buildParameters unit tests', function(t) {
  var parameters = lambdaCfn.build.buildParameters;
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

tape('lambda unit tests', function(t) {
  var lambda = lambdaCfn.build.buildLambda;
  var def = lambda({name: 'myHandler'});
  t.equal(def.Resources.myHandler.Properties.Handler, 'test/function.fn', 'Lambda handler correctly named');
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

tape('buildCloudWatchEvent unit tests', function(t) {
  var event = lambdaCfn.build.buildCloudwatchEvent;

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
      event(
        {
          name: 'test',
          eventSources: {
            cloudwatchEvent: {
            }}},
        'cloudwatchEvent');
    }, /eventPattern required for cloudwatch event/, 'Fail on no eventPattern'
  );

  t.throws(
    function() {
      event(
        {
          name: 'test',
          eventSources: {
            schedule: {
            }}},
        'schedule');
    }, /scheduled function expression cannot/, 'Fail on no schedule expression'
  );

  var def = event(
    {
      name: 'test',
      eventSources: {
        schedule: {
          expression: 'rate(5 minutes)'
        }}},
    'schedule');
  t.looseEqual(Object.keys(def.Resources), ['testSchedulePermission','testScheduleRule'], 'event rule and permission named correctly');
  t.equal(def.Resources.testScheduleRule.Properties.ScheduleExpression, 'rate(5 minutes)', 'schedule expression found');

  def = event(
    {
      name: 'test',
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

tape('buildWebhookEvent unit tests', function(t) {
  var webhookEvent = lambdaCfn.build.buildWebhookEvent;

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

  def = { name: 'test', eventSources: { webhook: { method: 'POST', apiKey: 'true'}}};
  var hook = webhookEvent(def);
  var r = hook.Resources.testWebhookResource;
  t.equal(r.Type,'AWS::ApiGateway::Resource');
  t.equal(r.Properties.RestApiId.Ref,'testWebhookApiGateway');
  t.equal(r.Properties.ParentId['Fn::GetAtt'][0],'testWebhookApiGateway');
  t.equal(r.Properties.ParentId['Fn::GetAtt'][1],'RootResourceId');
  t.equal(r.Properties.PathPart,'test');

  r = hook.Resources.testWebhookMethod;
  t.equal(r.Type,'AWS::ApiGateway::Method');
  t.equal(r.Properties.RestApiId.Ref,'testWebhookApiGateway');
  t.equal(r.Properties.ResourceId.Ref,'testWebhookResource');
  t.equal(r.Properties.AuthorizationType,'None');
  t.equal(r.Properties.HttpMethod,'POST');
  t.equal(r.Properties.Integration.Type,'AWS');
  t.equal(r.Properties.Integration.Uri['Fn::Join'][1][0], 'arn:aws:apigateway:');
  t.looseEqual(r.Properties.Integration.Uri['Fn::Join'][1][1], {Ref: 'AWS::Region'});
  t.equal(r.Properties.Integration.Uri['Fn::Join'][1][2], ':lambda:path/2015-03-31/functions/');
  t.looseEqual(r.Properties.Integration.Uri['Fn::Join'][1][3], {'Fn::GetAtt':['test','Arn']});
  t.equal(r.Properties.Integration.Uri['Fn::Join'][1][4], '/invocations');
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
  t.equal(r.Properties.AlarmActions[0].Ref, 'ServiceAlarmSNSTopic');

  r = hook.Resources.testWebhookApi4xxAlarm;
  t.equal(r.Type, 'AWS::CloudWatch::Alarm');
  t.equal(r.Properties.AlarmActions[0].Ref, 'ServiceAlarmSNSTopic');

  r = hook.Resources.testWebhookApiCountAlarm;
  t.equal(r.Type, 'AWS::CloudWatch::Alarm');
  t.equal(r.Properties.AlarmActions[0].Ref, 'ServiceAlarmSNSTopic');

  r = hook.Resources.testWebhookPermission;
  t.equal(r.Type, 'AWS::Lambda::Permission');
  t.equal(r.Properties.FunctionName['Fn::GetAtt'][0], 'test');

  t.equal(hook.Outputs.testWebhookApiKey.Ref,'testWebhookApiKey');

  // test empty integration
  def = { name: 'test', eventSources: { webhook: { method: 'POST', integration: {}}}};
  hook = webhookEvent(def);
  r = hook.Resources.testWebhookMethod;
  t.equal(r.Type,'AWS::ApiGateway::Method');
  t.equal(r.Properties.RestApiId.Ref,'testWebhookApiGateway');
  t.equal(r.Properties.ResourceId.Ref,'testWebhookResource');
  t.equal(r.Properties.AuthorizationType,'None');
  t.equal(r.Properties.HttpMethod,'POST');
  t.equal(r.Properties.Integration.Type,'AWS');
  t.equal(r.Properties.Integration.Uri['Fn::Join'][1][0], 'arn:aws:apigateway:');
  t.looseEqual(r.Properties.Integration.Uri['Fn::Join'][1][1], {Ref: 'AWS::Region'});
  t.equal(r.Properties.Integration.Uri['Fn::Join'][1][2], ':lambda:path/2015-03-31/functions/');
  t.looseEqual(r.Properties.Integration.Uri['Fn::Join'][1][3], {'Fn::GetAtt':['test','Arn']});
  t.equal(r.Properties.Integration.Uri['Fn::Join'][1][4], '/invocations');

  // test additions to integration defaults
  def = { name: 'test', eventSources: { webhook: { method: 'POST', integration: {
    Type: 'HOOK',
    PassthroughBehavior: 'WHEN_NO_TEMPLATES',
    RequestTemplates: {
      'application/x-www-form-urlencoded': '{ "postBody" : $input.json("$")}'
    }
  }}}};
  hook = webhookEvent(def);
  r = hook.Resources.testWebhookMethod;
  t.equal(r.Type,'AWS::ApiGateway::Method');
  t.equal(r.Properties.RestApiId.Ref,'testWebhookApiGateway');
  t.equal(r.Properties.ResourceId.Ref,'testWebhookResource');
  t.equal(r.Properties.AuthorizationType,'None');
  t.equal(r.Properties.HttpMethod,'POST');
  t.equal(r.Properties.Integration.Type,'HOOK');
  t.equal(r.Properties.Integration.Uri['Fn::Join'][1][0], 'arn:aws:apigateway:');
  t.looseEqual(r.Properties.Integration.Uri['Fn::Join'][1][1], {Ref: 'AWS::Region'});
  t.equal(r.Properties.Integration.Uri['Fn::Join'][1][2], ':lambda:path/2015-03-31/functions/');
  t.looseEqual(r.Properties.Integration.Uri['Fn::Join'][1][3], {'Fn::GetAtt':['test','Arn']});
  t.equal(r.Properties.Integration.Uri['Fn::Join'][1][4], '/invocations');
  t.equal(r.Properties.Integration.PassthroughBehavior, 'WHEN_NO_TEMPLATES');
  t.equal(r.Properties.Integration.RequestTemplates['application/x-www-form-urlencoded'],'{ "postBody" : $input.json("$")}');
  t.end();
});


tape('buildSnsEvent unit tests', function(t) {
  var sns = lambdaCfn.build.buildSnsEvent;
  var def = sns({ name: 'test' });
  t.equal(def.Resources.testSNSPermission.Type,'AWS::Lambda::Permission');
  t.equal(def.Resources.testSNSPermission.Properties.FunctionName['Fn::GetAtt'][0],'test');
  t.equal(def.Resources.testSNSPermission.Properties.SourceArn.Ref, 'testSNSTopic');

  t.equal(def.Resources.testSNSUser.Type,'AWS::IAM::User');
  t.equal(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[0].Resource.Ref,'testSNSTopic');
  t.deepEqual(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[0].Action, ['sns:ListTopics','sns:Publish'], 'Policy actions set correctly');
  t.equal(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[0].Effect,'Allow','Policy Effect set');
  t.equal(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[1].Resource['Fn::Join'][1][4],':*','List Account Topics policy set');
  t.deepEqual(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[1].Action, ['sns:ListTopics'], 'List Account Topics action set');
  t.equal(def.Resources.testSNSUser.Properties.Policies[0].PolicyDocument.Statement[1].Effect,'Allow','List Account Topics effect set');

  t.equal(def.Resources.testSNSTopic.Type, 'AWS::SNS::Topic');
  t.equal(def.Resources.testSNSTopic.Properties.DisplayName['Fn::Join'][1][1],'test');
  t.equal(def.Resources.testSNSTopic.Properties.TopicName['Fn::Join'][1][1],'test');
  t.equal(def.Resources.testSNSTopic.Properties.Subscription[0].Protocol,'lambda','Subcription protocol set correctly');
  t.equal(def.Resources.testSNSTopic.Properties.Subscription[0].Endpoint['Fn::GetAtt'][0],'test','Subcription endpoint set correctly');

  t.equal(def.Resources.testSNSUserAccessKey.Properties.UserName.Ref,'testSNSUser');

  t.equal(def.Outputs.testSNSTopic.Value.Ref,'testSNSTopic');
  t.equal(def.Outputs.testSNSUserAccessKey.Value.Ref,'testSNSUserAccessKey');
  t.equal(def.Outputs.testSNSUserSecretAccessKey.Value['Fn::GetAtt'][0],'testSNSUserAccessKey');
  t.equal(def.Outputs.testSNSUserSecretAccessKey.Value['Fn::GetAtt'][1],'SecretAccessKey');
  t.end();
});

tape('buildRole unit tests', function(t) {
  var role = lambdaCfn.build.buildRole;
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
            Effect: 'Allow',
            Action: [
              's3:GetObject'
            ],
            Resource: 'arn:aws:s3:::mySuperDuperBucket'
          },
          {
            Effect: 'Allow',
            NotAction: [
              's3:GetObject'
            ],
            NotResource: 'arn:aws:s3:::mySuperDuperBucket'
          }
        ]
      });
    });

  t.equal(myPolicy.Resources.LambdaCfnRole.Properties.Policies[1].PolicyName, 'myLambda');
  t.deepEqual(myPolicy.Resources.LambdaCfnRole.Properties.Policies[1], {
    PolicyName: 'myLambda',
    PolicyDocument: {
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject'
          ],
          Resource: 'arn:aws:s3:::mySuperDuperBucket'
        },
        {
          Effect: 'Allow',
          NotAction: [
            's3:GetObject'
          ],
          NotResource: 'arn:aws:s3:::mySuperDuperBucket'
        }
      ]
    }
  });

  t.end();
});

tape('buildServiceAlarms unit tests', function(t) {
  var alarms = lambdaCfn.build.buildServiceAlarms;
  var def = alarms({name: 'test'});
  t.notEqual(def.Resources.testAlarmErrors, undefined, 'Errors alarm is set');
  t.notEqual(def.Resources.testAlarmNoInvocations, undefined, 'NoInvocations alarm is set');
  t.equal(
    def.Resources.testAlarmErrors.Properties.ComparisonOperator,
    'GreaterThanThreshold', 'Uses correct comparison');
  t.equal(
    def.Resources.testAlarmNoInvocations.Properties.ComparisonOperator,
    'LessThanThreshold', 'Uses correct comparison');
  t.equal(
    def.Resources.testAlarmErrors.Properties.MetricName,
    'Errors', 'Uses correct metric name');
  t.equal(
    def.Resources.testAlarmNoInvocations.Properties.Namespace,
    'AWS/Lambda', 'uses correct metric namespace');
  t.equal(
    def.Resources.testAlarmErrors.Properties.Namespace,
    'AWS/Lambda', 'uses correct metric namespace');
  t.equal(def.Resources.ServiceAlarmSNSTopic.Type, 'AWS::SNS::Topic');
  t.equal(def.Resources.ServiceAlarmSNSTopic.Properties.TopicName['Fn::Join'][1][1],'ServiceAlarm');
  t.equal(def.Resources.ServiceAlarmSNSTopic.Properties.Subscription[0].Endpoint.Ref, 'ServiceAlarmEmail');

  t.notEqual(def.Parameters.ServiceAlarmEmail, undefined, 'ServiceAlarmEmail Parameter set');
  t.equal(def.Variables.ServiceAlarmSNSTopic.Ref,'ServiceAlarmSNSTopic');

  t.end();
});

tape('buildSNSDestination unit tests', function(t) {
  var sns = lambdaCfn.build.buildSnsDestination;

  var def = sns({name: 'test', destinations: {sns: {mySns: { Description: 'test'}}}});
  t.notEqual(def.Parameters.mySnsEmail, undefined, 'Parameter found');
  t.equal(Array.isArray(def.Policies), true, 'Policies array is present');
  t.looseEqual(def.Policies[0].PolicyName, 'mySnsTopicPermissions');
  t.looseEqual(def.Policies[0].PolicyDocument.Statement[0],{ Effect: 'Allow', Action: 'sns:Publish', Resource: { Ref: 'test'}}, 'SNS destination policy matched');
  t.equal(def.Resources.mySnsTopic.Type, 'AWS::SNS::Topic');
  t.equal(def.Resources.mySnsTopic.Properties.Subscription[0].Endpoint.Ref, 'mySnsEmail');
  t.equal(def.Variables.mySnsTopic.Ref, 'mySnsTopic');
  t.end();
});
