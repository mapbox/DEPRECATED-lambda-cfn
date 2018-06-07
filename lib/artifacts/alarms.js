const cf = require('@mapbox/cloudfriend');

const DEFAULT_LAMBDA_SETTINGS = {
  THRESHOLD: 0,
  EVALUATION_PERIODS: 5,
  PERIOD: 60
};

/**
 * Create resources to send alarms on lambda errors and lambda no invocations.
 *
 * The resources which this function creates are:
 *
 * - Errors CloudWatch alarm
 * - NoInvocations CloudWatch alarm
 * - ServiceAlarmEmail parameter
 * - Service Alarm SNS Topic
 *
 * @param options
 * @returns An object with alarms artifacts
 */
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
        EvaluationPeriods: `${setLambdaEvaluationPeriods(options.evaluationPeriods)}`,
        Statistic: 'Sum',
        Threshold: `${setLambdaThreshold(options.threshold)}`,
        AlarmDescription: 'https://github.com/mapbox/lambda-cfn/blob/master/alarms.md#' + alarm.AlarmName,
        Period: `${setLambdaPeriod(options.period)}`,
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

function setLambdaThreshold(threshold) {
  if (!threshold) {
    return DEFAULT_LAMBDA_SETTINGS.THRESHOLD;
  } else if (threshold >= 0){
    return threshold;
  } else if (threshold < 0) {
    return 0;
  } else {
    return DEFAULT_LAMBDA_SETTINGS.THRESHOLD;
  }
}

function setLambdaEvaluationPeriods(evaluationPeriods) {
  if (!evaluationPeriods) {
    return DEFAULT_LAMBDA_SETTINGS.EVALUATION_PERIODS;
  } else if (evaluationPeriods >= 0){
    return evaluationPeriods;
  } else if (evaluationPeriods < 0) {
    return DEFAULT_LAMBDA_SETTINGS.EVALUATION_PERIODS;
  } else {
    return DEFAULT_LAMBDA_SETTINGS.EVALUATION_PERIODS;
  }
}

function setLambdaPeriod(period) {
  if (!period) {
    return DEFAULT_LAMBDA_SETTINGS.PERIOD;
  } else if (period >= 0){
    return period;
  } else if (period < 0) {
    return DEFAULT_LAMBDA_SETTINGS.PERIOD;
  } else {
    return DEFAULT_LAMBDA_SETTINGS.PERIOD;
  }
}

module.exports.buildServiceAlarms = buildServiceAlarms;
