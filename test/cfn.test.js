const tape = require('tape');
const lambdaCfn = require('../index.js');

tape('buildFunctionTemplate unit tests', (t) => {
  let template = lambdaCfn.build.buildFunctionTemplate;
  let def = template({name: 'test'});
  t.equal(def.AWSTemplateFormatVersion, '2010-09-09', 'Template format version');
  t.equal(def.Description, 'test lambda-cfn function', 'Template description');
  t.end();
});

tape('compileFunction unit tests', (t) => {
  let compile = lambdaCfn.build.compileFunction;
  let template = {};
  let arg = {};
  let testSet = ['Metadata', 'Parameters', 'Mappings', 'Conditions', 'Resources', 'Outputs', 'Variables'];

  testSet.map((m) => {
    template[m] = { m1: {} };
    arg[m] = { m1: {} };
    t.throws(
      function() {
        compile(template, arg);
      }, /name used more than once/, 'Fail when duplicate ' + m + ' objects');
  });

  let p1 = {Policies: [{a: 'b'},{c: 'd'}]};
  let p2 = {Policies: [{e: 'f'},{g: 'h'}]};
  let def = compile(p1,p2);
  t.looseEqual(def.Policies, [{a: 'b'}, {c: 'd'}, {e: 'f'}, {g: 'h'}], 'Policies array created correctly');

  p1 = {Policies: []};
  p2 = {Policies: {}};
  def = compile(p1, p2);
  t.equal(def.Policies, undefined, 'Empty Policies skipped');
  t.end();
});

tape('buildFunction unit tests', function(t) {
  let lambda = lambdaCfn.build.buildFunction;
  t.throws(
    function() { lambda({}); }, /Function name is required/, 'Fail when no function name given'
  );

  let def = lambda({name: 'test'});
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

  let i = 0;
  let parameters = {};
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
  let parameters = lambdaCfn.build.buildParameters;
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
  let lambda = lambdaCfn.build.buildLambda;
  let def = lambda({name: 'myLambda'});
  t.equal(def.Resources.myLambda.Properties.Handler, 'test/function.fn', 'Lambda handler correctly named');
  t.equal(def.Resources.myLambda.Properties.MemorySize, 128, 'Lambda memory size default correct');
  t.equal(def.Resources.myLambda.Properties.Timeout, 60, 'Lambda timeout default correct');

  def = lambda({name: 'myLambda', handler: 'lambdaDirectory/lambdaFunction.fn'});
  t.equal(def.Resources.myLambda.Properties.Handler, 'lambdaDirectory/lambdaFunction.fn', 'Use custom Lambda handler');

  def = lambda({name: 'myLambda', memorySize: 512, timeout: 300});
  t.equal(def.Resources.myLambda.Properties.MemorySize, 512, 'Lambda memory size updated');
  t.equal(def.Resources.myLambda.Properties.Timeout, 300, 'Lambda timeout updated');

  def = lambda({name: 'myLambda', memorySize: 512, timeout: 111});
  t.equal(def.Resources.myLambda.Properties.Timeout, 111, 'Lambda custom timeout correct');

  def = lambda({name: 'myLambda', memorySize: 512, timeout:-5});
  t.equal(def.Resources.myLambda.Properties.Timeout, 60, 'Negative timeout defaulted correctly');

  def = lambda({name: 'myLambda', memorySize: 4096, timeout: 1200});
  t.equal(def.Resources.myLambda.Properties.MemorySize, 3008, 'Lambda memory size > 3008 safe default');
  t.equal(def.Resources.myLambda.Properties.Timeout, 900, 'Lambda timeout safe default');

  def = lambda({name: 'myLambda', memorySize: 1111, timeout: 60});
  t.equal(def.Resources.myLambda.Properties.MemorySize, 1088, 'Lambda memory size mod 64 safe default');

  def = lambda({name: 'myLambda', memorySize: 12, timeout: 60});
  t.equal(def.Resources.myLambda.Properties.MemorySize, 128, 'Lambda min memory size default');
  t.throws(
    function() {
      lambda({name: 'myLambda', runtime: 'nodejs'});
    }, /Invalid AWS Lambda node.js runtime/, 'Fail when bad nodejs runtime given'
  );

  def = lambda({name: 'myLambda', runtime: 'nodejs8.10'});
  t.equal(def.Resources.myLambda.Properties.Runtime, 'nodejs8.10', 'Created Node 8.10 runtime Lambda');

  def = lambda({name: 'myLambda'});
  t.equal(def.Resources.myLambda.Properties.Runtime, 'nodejs10.x', 'Default to Node 10.x runtime if not specified');

  t.end();
});

tape('buildCloudWatchEvent unit tests', function(t) {
  let event = lambdaCfn.build.buildCloudwatchEvent;

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
            }
          }
        },
        'cloudwatchEvent'
      );
    }, /eventPattern required for cloudwatch event/, 'Fail on no eventPattern'
  );

  t.throws(
    function() {
      event(
        {
          name: 'test',
          eventSources: {
            schedule: {
            }
          }
        },
        'schedule'
      );
    }, /scheduled function expression cannot/, 'Fail on no schedule expression'
  );

  let def = event(
    {
      name: 'test',
      eventSources: {
        schedule: {
          expression: 'rate(5 minutes)'
        }
      }
    },
    'schedule'
  );
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
          }
        }
      }
    },
    'cloudwatchEvent'
  );
  t.looseEqual(def.Resources.testCloudwatchEventRule.Properties.EventPattern, {'detail-type': [], detail: {}}, 'found event pattern');
  t.end();
});

tape('buildWebhookEvent unit tests', (t) => {
  let webhookEvent = lambdaCfn.build.buildWebhookEvent;

  let def = { name: 'test', eventSources: { webhook: {}}};
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

  def = {name: 'test', eventSources: { webhook: { method: 'POST', apiKey: 'true'}}};

  let hook = webhookEvent(def);
  let r = hook.Resources.testWebhookResource;

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

  let output = {
    'Fn::Join': [
      '',
      [
        'https://',
        {
          Ref: 'testWebhookApiGateway'
        },
        '.execute-api.',
        {
          Ref: 'AWS::Region'
        },
        '.amazonaws.com/prod/',
        'test'
      ]
    ]
  };
  t.equal(hook.Outputs.testWebhookApiKey.Value.Ref,'testWebhookApiKey');
  t.deepLooseEqual(hook.Outputs.testWebhookAPIEndpoint.Value, output);

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
  let sns = lambdaCfn.build.buildSnsEvent;
  let def = sns({ name: 'test' });

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
  let role = lambdaCfn.build.buildRole;
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

  let myPolicy;

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
  let alarms = lambdaCfn.build.buildServiceAlarms;
  let def = alarms({name: 'test'});
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

  t.equal(def.Resources.testAlarmErrors.Properties.Threshold, '0', 'Lambda threshold deafults to 0');
  t.equal(def.Resources.testAlarmErrors.Properties.EvaluationPeriods, '5', 'Lambda evaluation periods deafults to 5');
  t.equal(def.Resources.testAlarmErrors.Properties.Period, '60', 'Lambda period deafults to 60');

  def = alarms({name: 'test', threshold: 3, evaluationPeriods: 2, period: 40});
  t.equal(def.Resources.testAlarmErrors.Properties.Threshold, '3', 'Lambda threshold set to 3');
  t.equal(def.Resources.testAlarmErrors.Properties.EvaluationPeriods, '2', 'Lambda evaluation periods set to 2');
  t.equal(def.Resources.testAlarmErrors.Properties.Period, '40', 'Lambda period set to 40');

  def = alarms({name: 'test', threshold: -1, evaluationPeriods: -1, period: -1});
  t.equal(def.Resources.testAlarmErrors.Properties.Threshold, '0', 'Lambda threshold sets to 0 with negative number');
  t.equal(def.Resources.testAlarmErrors.Properties.EvaluationPeriods, '5', 'Lambda evaluation periods set to 5 with negative number');
  t.equal(def.Resources.testAlarmErrors.Properties.Period, '60', 'Lambda period set to 60 with negative number');
  t.end();
});

tape('buildSNSDestination unit tests', function(t) {
  let sns = lambdaCfn.build.buildSnsDestination;
  let def = sns({name: 'test', destinations: {sns: {mySns: { Description: 'test'}}}});

  t.notEqual(def.Parameters.mySnsEmail, undefined, 'Parameter found');
  t.equal(Array.isArray(def.Policies), true, 'Policies array is present');
  t.looseEqual(def.Policies[0].PolicyName, 'mySnsTopicPermissions');
  t.looseEqual(def.Policies[0].PolicyDocument.Statement[0],{ Effect: 'Allow', Action: 'sns:Publish', Resource: {Ref: 'test'}}, 'SNS destination policy matched');
  t.equal(def.Resources.mySnsTopic.Type, 'AWS::SNS::Topic');
  t.equal(def.Resources.mySnsTopic.Properties.Subscription[0].Endpoint.Ref, 'mySnsEmail');
  t.equal(def.Variables.mySnsTopic.Ref, 'mySnsTopic');
  t.end();
});
