const cf = require('@mapbox/cloudfriend');

/**
 * Creates resources to allow webhook events
 */
function buildWebhookEvent(options) {
  const webhookName = options.name + 'Webhook';
  let webhook = {
    Resources: {},
    Outputs: {}
  };

  validteWebhookOptions(options);

  webhook.Resources[webhookName + 'Resource'] = {
    Type: 'AWS::ApiGateway::Resource',
    Properties: {
      ParentId: cf.getAtt(webhookName + 'ApiGateway', 'RootResourceId'),
      RestApiId: cf.ref(webhookName + 'ApiGateway'),
      PathPart: options.name.toLowerCase()
    }
  };

  if (options.eventSources.webhook.method) {
    if (!options.eventSources.webhook.methodResponses) {
      options.eventSources.webhook.methodResponses = [
        {
          StatusCode: '200',
          ResponseModels: {
            'application/json': 'Empty'
          }
        },
        {
          StatusCode: '500',
          ResponseModels: {
            'application/json': 'Empty'
          }
        }
      ];
    } else if (!Array.isArray(options.eventSources.webhook.methodResponses)) {
      throw new Error('Webhook method responses is not an array');
    }

    if (!options.eventSources.webhook.integration) {
      options.eventSources.webhook.integration = {};
    }

    // sets safe defaults for missing parameters if integration object is passed
    options.eventSources.webhook.integration.Type = options.eventSources.webhook.integration.Type ? options.eventSources.webhook.integration.Type : 'AWS';
    options.eventSources.webhook.integration.IntegrationHttpMethod = options.eventSources.webhook.integration.IntegrationHttpMethod ? options.eventSources.webhook.integration.IntegrationHttpMethod : 'POST';
    options.eventSources.webhook.integration.Uri = options.eventSources.webhook.integration.Uri ? options.eventSources.webhook.integration.Uri : cf.join(['arn:aws:apigateway:', cf.region, ':lambda:path/2015-03-31/functions/', cf.getAtt(options.name, 'Arn'), '/invocations']);
    options.eventSources.webhook.integration.IntegrationResponses = options.eventSources.webhook.integration.IntegrationResponses ? options.eventSources.webhook.integration.IntegrationResponses : [{ StatusCode: '200' }, { StatusCode: '500', SelectionPattern: '^(?i)(error|exception).*'}];

    webhook.Resources[webhookName + 'Method'] = {
      Type: 'AWS::ApiGateway::Method',
      Properties: {
        RestApiId: cf.ref(webhookName + 'ApiGateway'),
        ResourceId: cf.ref(webhookName + 'Resource'),
        AuthorizationType: 'None',
        HttpMethod: options.eventSources.webhook.method.toUpperCase(),
        MethodResponses: options.eventSources.webhook.methodResponses,
        Integration: options.eventSources.webhook.integration
      }
    };
  }

  webhook.Resources[webhookName + 'Permission'] = {
    Type: 'AWS::Lambda::Permission',
    Properties: {
      FunctionName: cf.getAtt(options.name, 'Arn'),
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: cf.join(['arn:aws:execute-api:', cf.region, ':', cf.accountId, ':', cf.ref(webhookName + 'ApiGateway'),'/*'])
    }
  };

  webhook.Resources[webhookName + 'ApiGateway'] = {
    Type: 'AWS::ApiGateway::RestApi',
    Properties: {
      Name: cf.stackName,
      FailOnWarnings: 'true'
    }
  };

  // randomizes deployment name so that code can be redeployed over an existing stage
  let apiDeploymentRandom = getApiDeploymentName();

  webhook.Resources[webhookName + 'ApiKey'] = {
    Type: 'AWS::ApiGateway::ApiKey',
    DependsOn: webhookName + apiDeploymentRandom,
    Properties: {
      Name: cf.stackName,
      Enabled: 'true',
      StageKeys: [
        {
          RestApiId: cf.ref(webhookName + 'ApiGateway'),
          StageName: 'prod'
        }
      ]
    }
  };

  webhook.Resources[webhookName + apiDeploymentRandom] = {
    Type: 'AWS::ApiGateway::Deployment',
    DependsOn: webhookName + 'Method',
    Properties: {
      RestApiId: cf.ref(webhookName + 'ApiGateway'),
      StageName: 'prod'
    }
  };

  webhook.Resources[webhookName + 'ApiLatencyAlarm'] = {
    Type: 'AWS::CloudWatch::Alarm',
    Properties: {
      EvaluationPeriods: '5',
      Statistic: 'Sum',
      Threshold: '4',
      AlarmDescription: 'https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#ApiLatencyAlarm',
      Period: '60',
      AlarmActions: [
        cf.ref('ServiceAlarmSNSTopic')
      ],
      Namespace: 'AWS/ApiGateway',
      Dimensions: [
        {
          Name: 'APIName',
          Value: cf.stackName
        }
      ],
      ComparisonOperator: 'GreaterThanThreshold',
      MetricName: 'Latency'
    }
  };

  webhook.Resources[webhookName + 'Api4xxAlarm'] = {
    Type: 'AWS::CloudWatch::Alarm',
    Properties: {
      EvaluationPeriods: '5',
      Statistic: 'Sum',
      Threshold: '100',
      AlarmDescription: 'https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#Api4xxAlarm',
      Period: '60',
      AlarmActions: [ cf.ref('ServiceAlarmSNSTopic') ],
      Namespace: 'AWS/ApiGateway',
      Dimensions: [
        {
          Name: 'APIName',
          Value: cf.stackName
        }
      ],
      ComparisonOperator: 'GreaterThanThreshold',
      MetricName: '4xxError'
    }
  };

  webhook.Resources[webhookName + 'ApiCountAlarm'] = {
    Type: 'AWS::CloudWatch::Alarm',
    Properties: {
      EvaluationPeriods: '5',
      Statistic: 'Sum',
      Threshold: '10000',
      AlarmDescription: 'https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#ApiCountAlarm',
      Period: '60',
      AlarmActions: [
        cf.ref('ServiceAlarmSNSTopic')
      ],
      Namespace: 'AWS/ApiGateway',
      Dimensions: [
        {
          Name: 'APIName',
          Value: cf.stackName
        }
      ],
      ComparisonOperator: 'GreaterThanThreshold',
      MetricName: 'Count'
    }
  };

  webhook.Resources[webhookName + 'Permission'] = {
    Type: 'AWS::Lambda::Permission',
    Properties: {
      FunctionName: cf.getAtt(options.name, 'Arn'),
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: cf.join(['arn:aws:execute-api:', cf.region, ':', cf.accountId, ':', cf.ref(webhookName + 'ApiGateway'), '/*'])
    }
  };

  webhook.Outputs[webhookName + 'APIEndpoint'] = {
    Value: cf.join(['https://', cf.ref(webhookName + 'ApiGateway'), '.execute-api.', cf.region, '.amazonaws.com/prod/', options.name.toLowerCase()])
  };

  if (options.eventSources.webhook.apiKey) {
    webhook.Resources[webhookName + 'Method'].Properties.ApiKeyRequired = 'true';
    webhook.Outputs[webhookName + 'ApiKey'] = {
      Value: cf.ref(webhookName + 'ApiKey')
    };
  }

  return webhook;
}


function validteWebhookOptions(options) {
  if (!options.eventSources.webhook.method) {
    throw new Error('Webhook function method not found');
  }

  let isValidHTTPMethod = /GET|HEAD|PUT|PATCH|OPTIONS|POST|DELETE/.test(options.eventSources.webhook.method.toUpperCase()) === true;
  if (!isValidHTTPMethod) {
    throw new Error('Invalid client HTTP method specified: ' + options.eventSources.webhook.method);
  }
}

function getApiDeploymentName() {
  if (process.env.NODE_ENV == 'test') {
    return 'ApiDeployment';
  }

  return 'ApiDeployment' + Math.random().toString(36).slice(2);
}

module.exports.buildWebhookEvent = buildWebhookEvent;
