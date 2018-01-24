const cf = require('@mapbox/cloudfriend');

function buildRole(options) {
  let role = {
    Resources: {}
  };

  role.Resources['LambdaCfnRole'] = {
    Type: 'AWS::IAM::Role',
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
                  'logs:*'
                ],
                Resource: cf.join(['arn:aws:logs:*:', cf.accountId, ':*'])
              },
              {
                Effect: 'Allow',
                Action: [
                  'sns:Publish'
                ],
                Resource: cf.ref('ServiceAlarmSNSTopic')
              },
              {
                Effect: 'Allow',
                Action: [
                  'iam:SimulateCustomPolicy'
                ],
                Resource: '*'
              }
            ]
          }
        },
      ]
    }
  };


  if (options.eventSources && options.eventSources.webhook) {
    role.Resources['LambdaCfnRole'].Properties.AssumeRolePolicyDocument.Statement.push({
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
    role.Resources['LambdaCfnRole'].Properties.Policies.push({
      PolicyName: options.name,
      PolicyDocument: {
        Statement: options.statements
      }
    });
  }

  return role;
}

module.exports.buildRole = buildRole;
