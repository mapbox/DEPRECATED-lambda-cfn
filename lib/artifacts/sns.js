const cf = require('@mapbox/cloudfriend');

function buildSnsEvent(options) {
  let snsEvent = {
    Resources: {},
    Outputs: {}
  };

  snsEvent.Resources[options.name + 'SNSPermission'] = {
    Type: 'AWS::Lambda::Permission',
    Properties: {
      FunctionName: cf.getAtt(options.name, 'Arn'),
      Action: 'lambda:InvokeFunction',
      Principal: 'sns.amazonaws.com',
      SourceArn: cf.ref(options.name + 'SNSTopic')
    }
  };

  snsEvent.Resources[options.name + 'SNSUser'] = {
    Type: 'AWS::IAM::User',
    Properties: {
      Policies: [
        {
          PolicyName: options.name + 'SNSTopicPolicy',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Resource: cf.ref(options.name + 'SNSTopic'),
                Action: [
                  'sns:ListTopics',
                  'sns:Publish',
                ],
                Effect: 'Allow'
              },
              // required permissions for Zapier SNS integrations
              {
                Resource: cf.join(['arn:aws:sns:', cf.region, ':', cf.accountId, ':*']),
                Action: [
                  'sns:ListTopics',
                ],
                Effect: 'Allow'
              }
            ]
          }
        }
      ]
    }
  };

  snsEvent.Resources[options.name + 'SNSTopic'] = {
    Type: 'AWS::SNS::Topic',
    Properties: {
      DisplayName: cf.join('-', [cf.stackName, options.name]),
      TopicName: cf.join('-', [cf.stackName, options.name]),
      Subscription: [
        {
          Endpoint: cf.getAtt(options.name, 'Arn'),
          Protocol: 'lambda'
        }
      ]
    }
  };

  snsEvent.Resources[options.name + 'SNSUserAccessKey'] = {
    Type: 'AWS::IAM::AccessKey',
    Properties: {
      UserName: cf.ref(options.name + 'SNSUser')
    }
  };

  snsEvent.Outputs[options.name + 'SNSTopic'] = {
    Value: cf.ref(options.name + 'SNSTopic')
  };
  snsEvent.Outputs[options.name + 'SNSUserAccessKey'] = {
    Value: cf.ref(options.name + 'SNSUserAccessKey')
  };
  snsEvent.Outputs[options.name + 'SNSUserSecretAccessKey'] = {
    Value: cf.getAtt(options.name + 'SNSUserAccessKey', 'SecretAccessKey')
  };

  return snsEvent;
}

module.exports.buildSnsEvent = buildSnsEvent;
