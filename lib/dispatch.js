const cf = require('@mapbox/cloudfriend');

function addDispatchSupport(template) {
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

  template.Resources['DispatchRole'] = {
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
}

module.exports.addDispatchSupport = addDispatchSupport;
