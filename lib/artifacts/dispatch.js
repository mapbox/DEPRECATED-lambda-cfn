const cf = require('@mapbox/cloudfriend');
const role = require('./roles');

/**
 * Create all that is need it to send messages to Dispatch SNS
 * Resources created by this function are
 *
 * - HasDispatchSnsArn conditional
 * - DispatchSnsArn parameter
 * - LambdaCfnDispatchRole
 *
 * @param template
 * @param options
 */
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

  // Why we need other role for Dispatch?
  // We can not use conditionals at policy level. We create a new role with all the properties of the
  // default role plus the conditional and policy to send messages to DispatchSnsArn.
  let dispatchRole = role.buildRole(options, 'LambdaCfnDispatchRole');
  template.Resources['LambdaCfnDispatchRole'] = dispatchRole.Resources['LambdaCfnDispatchRole'];
  template.Resources['LambdaCfnDispatchRole'].Condition = 'HasDispatchSnsArn';
  template.Resources['LambdaCfnDispatchRole'].Properties.Policies[0].PolicyDocument.Statement.push(
    {
      Effect: 'Allow',
      Action: [
        'sns:Publish'
      ],
      Resource: cf.ref('DispatchSnsArn')
    }
  );
}

module.exports.addDispatchSupport = addDispatchSupport;
