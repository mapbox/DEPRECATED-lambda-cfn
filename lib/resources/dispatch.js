const cf = require('@mapbox/cloudfriend');

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
    let areValidStatementsOptions = !Array.isArray(options.statements);
    if (areValidStatementsOptions) {
      throw new Error('options.statements must be an array');
    }
  }

  if (options.statements) {
    // Very basic validation on each policy statement
    options.statements.forEach((statement) => {
      if (!statement.Effect)
        throw new Error('statement must contain Effect');
      if (!statement.Resource && !statement.NotResource)
        throw new Error('statement must contain Resource or NotResource');
      if (!statement.Action && !statement.NotAction)
        throw new Error('statement must contain Action or NotAction');
    });
    template.Resources['LambdaCfnDispatchRole'].Properties.Policies.push({
      PolicyName: options.name,
      PolicyDocument: {
        Statement: options.statements
      }
    });
  }
}

module.exports.addDispatchSupport = addDispatchSupport;
