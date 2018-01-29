const cf = require('@mapbox/cloudfriend');

/**
 * for porting existing lambda-cfn code over, if an SNS destination
 * is defaulted, then use the ServiceAlarmEmail, else create a new Topic
 * @param options
 */
function buildSnsDestination(options) {

  let sns = {
    Resources: {},
    Parameters: {},
    Variables: {},
    Policies: []
  };

  if (options.destinations && options.destinations.sns) {
    for (let destination in options.destinations.sns) {
      sns.Parameters[destination + 'Email'] = {
        Type: 'String',
        Description:  options.destinations.sns[destination].Description
      };

      sns.Policies.push({
        PolicyName: destination + 'TopicPermissions',
        PolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Action: 'sns:Publish',
              Resource: cf.ref(options.name)
            }
          ]
        }
      });

      sns.Resources[destination + 'Topic'] = {
        Type: 'AWS::SNS::Topic',
        Properties: {
          TopicName: cf.join('-', [cf.stackName, destination]),
          Subscription: [
            {
              Endpoint: cf.ref(destination + 'Email'),
              Protocol: 'email'
            }
          ]
        }
      };

      sns.Variables[destination + 'Topic'] = cf.ref(destination + 'Topic');
    }
    return sns;
  }
}

module.exports.buildSnsDestination = buildSnsDestination;
