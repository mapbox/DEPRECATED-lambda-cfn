const cf = require('@mapbox/cloudfriend');
const utils = require('../utils');

/**
 * Build CloudWatch events
 *
 * This function creates
 *
 * - A Permission to access lambda invokation events
 * - A EventPattern rule in case of cloudwatchEvent function type
 * - A Schedule Expression in case of schedule function type.
 * @param options
 * @param functionType
 */
function buildCloudwatchEvent(options, functionType) {
  validateCloudWatchEvent(functionType, options.eventSources);

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
      RoleArn: cf.if('HasDispatchSnsArn', cf.getAtt('LambdaCfnDispatchRole', 'Arn'), cf.getAtt('LambdaCfnRole', 'Arn')),
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

function validateCloudWatchEvent(functionType, eventSources) {
  if (!functionType) {
    throw new Error('functionType property required for cloudwatch event');
  }

  let isAllowFunctionType;
  isAllowFunctionType = functionType.match(/cloudwatchEvent|schedule/);
  if (!isAllowFunctionType) {
    throw new Error('unknown functionType property: ' + functionType);
  }

  let isCloudWatchEvent = (functionType === 'cloudwatchEvent' && !eventSources.cloudwatchEvent.eventPattern);
  if (isCloudWatchEvent) {
    throw new Error('eventPattern required for cloudwatch event');
  }

  let isScheduleEvent = (functionType === 'schedule' && !eventSources.schedule.expression);
  if (isScheduleEvent) {
    throw new Error('scheduled function expression cannot be undefined');
  }
}

module.exports.buildCloudwatchEvent = buildCloudwatchEvent;
