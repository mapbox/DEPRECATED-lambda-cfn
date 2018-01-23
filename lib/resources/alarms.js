const cf = require('@mapbox/cloudfriend');

function buildServiceAlarms(options) {
  let alarms = {
    Parameters: {},
    Resources: {},
    Variables: {}
  };

  let defaultAlarms = [
    {
      AlarmName: 'Errors',
      MetricName: 'Errors',
      ComparisonOperator: 'GreaterThanThreshold'
    },
    {
      AlarmName: 'NoInvocations',
      MetricName: 'Invocations',
      ComparisonOperator: 'LessThanThreshold'
    }
  ];

  defaultAlarms.forEach(function(alarm) {
    alarms.Resources[options.name + 'Alarm' + alarm.AlarmName] = {
      Type: 'AWS::CloudWatch::Alarm',
      Properties: {
        EvaluationPeriods: '5',
        Statistic: 'Sum',
        Threshold: '0',
        AlarmDescription: 'https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#' + alarm.AlarmName,
        Period: '60',
        AlarmActions: [cf.ref('ServiceAlarmSNSTopic')],
        Namespace: 'AWS/Lambda',
        Dimensions: [
          {
            Name: 'FunctionName',
            Value: cf.ref(options.name)
          }
        ],
        ComparisonOperator: alarm.ComparisonOperator,
        MetricName: alarm.MetricName
      }
    };
  });

  alarms.Parameters = {
    ServiceAlarmEmail:{
      Type: 'String',
      Description: 'Service alarm notifications will send to this email address'
    }
  };

  alarms.Resources.ServiceAlarmSNSTopic = {
    Type: 'AWS::SNS::Topic',
    Properties: {
      TopicName: cf.join('-', [cf.stackName, 'ServiceAlarm']),
      Subscription: [
        {
          Endpoint: cf.ref('ServiceAlarmEmail'),
          Protocol: 'email'
        }
      ]
    }
  };

  alarms.Variables.ServiceAlarmSNSTopic = cf.ref('ServiceAlarmSNSTopic');
  return alarms;
}

module.exports.buildServiceAlarms = buildServiceAlarms;
