const cf = require('@mapbox/cloudfriend');
const utils = require('../utils');

function buildCloudwatchEvent(options, functionType) {
  if (!functionType) throw new Error('functionType property required for cloudwatch event');

  let isAllowFunctionType = functionType.match(/cloudwatchEvent|schedule/);
  if (!isAllowFunctionType) throw new Error('unknown functionType property: ' + functionType);

  if (functionType === 'cloudwatchEvent' && !options.eventSources.cloudwatchEvent.eventPattern) throw new Error('eventPattern required for cloudwatch event');
  if (functionType === 'schedule' && !options.eventSources.schedule.expression) throw new Error('scheduled function expression cannot be undefined');

  let eventName = options.name + utils.capitalizeFirst(functionType);
  let event = {
    Resources: {}
  };

  event.Resources[eventName + 'Permission'] = {
    Type: 'AWS::Lambda::Permission',
    Properties: {
      FunctionName: cf.getAtt(options.name, 'Arn'),
      Action: 'lambda:InvokeFunction',
      Principal: 'events.amazonaws.com',
      SourceArn: cf.getAtt(eventName + 'Rule', 'Arn')
    }
  };

  event.Resources[eventName + 'Rule'] = {
    Type: 'AWS::Events::Rule',
    Properties: {
      RoleArn: cf.getAtt('LambdaCfnRole', 'Arn'),
      State: 'ENABLED',
      Targets: [
        {
          Arn: cf.getAtt(options.name, 'Arn'),
          Id: options.name
        }
      ]
    }
  };

  if (functionType === 'cloudwatchEvent') {
    event.Resources[eventName + 'Rule'].Properties.EventPattern = options.eventSources.cloudwatchEvent.eventPattern;
  } else {
    event.Resources[eventName + 'Rule'].Properties.ScheduleExpression = options.eventSources.schedule.expression;
  }

  return event;
}

module.exports.buildCloudwatchEvent = buildCloudwatchEvent;
