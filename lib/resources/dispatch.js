const cf = require('@mapbox/cloudfriend');
const role = require('./roles');

function addDispatchSupport(template, options) {
  if (!template.Conditions) {
    template.Conditions = {};
  }
  if (!('HasDispatchSnsArn' in template.Conditions)) {
    template.Conditions['HasDispatchSnsArn'] = {
      'Fn::Not': [
        {
          'Fn::Equals': [
            '',
            cf.ref('DispatchSnsArn')
          ]
        }
      ]
    };
  }

  template.Parameters.DispatchSnsArn = {
    Type: 'String',
    Description: 'Dispatch SNS ARN (Optional)'
  };

  template.Resources['LambdaCfnDispatchRole'] = {
    Type: 'AWS::IAM::Role',
    Condition: 'HasDispatchSnsArn',
    Properties: {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Sid: '',
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          },
          {
            Sid: '',
            Effect: 'Allow',
            Principal: {
              Service: 'events.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      },
      Path: '/',
      Policies: [
        {
          PolicyName: 'basic',
          PolicyDocument: {
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'sns:Publish'
                ],
                Resource: cf.ref('DispatchSnsArn')
              },
            ]
          }
        },
      ]
    }
  };

  if (options.eventSources && options.eventSources.webhook) {
    template.Resources['LambdaCfnDispatchRole'].Properties.AssumeRolePolicyDocument.Statement.push({
      Sid: '',
      Effect: 'Allow',
      Principal: {
        Service: 'apigateway.amazonaws.com'
      },
      Action: 'sts:AssumeRole'
    });
  }

  if (options.statements) {
    role.statementValidation(options);
    template.Resources['LambdaCfnDispatchRole'].Properties.Policies.push({
      PolicyName: options.name,
      PolicyDocument: {
        Statement: options.statements
      }
    });
  }
}

module.exports.addDispatchSupport = addDispatchSupport;
