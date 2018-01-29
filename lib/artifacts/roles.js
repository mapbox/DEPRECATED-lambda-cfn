const cf = require('@mapbox/cloudfriend');

/**
 * Build a role with permissions to lambda, CloudWatch events and API Gateways is needed.
 */
function buildRole(options, roleName='LambdaCfnRole') {
  let role = {
    Resources: {}
  };

  role.Resources[roleName] = {
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
    role.Resources[roleName].Properties.AssumeRolePolicyDocument.Statement.push({
      Sid: '',
      Effect: 'Allow',
      Principal: {
        Service: 'apigateway.amazonaws.com'
      },
      Action: 'sts:AssumeRole'
    });
  }

  if (options.statements) {
    statementValidation(options);

    role.Resources[roleName].Properties.Policies.push({
      PolicyName: options.name,
      PolicyDocument: {
        Statement: options.statements
      }
    });
  }

  return role;
}


function statementValidation(options) {
  let areValidStatementsOptions = !Array.isArray(options.statements);
  if (areValidStatementsOptions) {
    throw new Error('options.statements must be an array');
  }

  // Very basic validation on each policy statement
  options.statements.forEach((statement) => {
    if (!statement.Effect) {
      throw new Error('statement must contain Effect');
    }
    if (!statement.Resource && !statement.NotResource) {
      throw new Error('statement must contain Resource or NotResource');
    }
    if (!statement.Action && !statement.NotAction) {
      throw new Error('statement must contain Action or NotAction');
    }
  });
}

module.exports.buildRole = buildRole;
module.exports.statementValidation = statementValidation;
