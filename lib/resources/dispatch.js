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

  let dispatchRole = role.buildRole(options, 'dispatch');
  template.Resources['LambdaCfnDispatchRole'] = dispatchRole.Resources['LambdaCfnDispatchRole'];
  template.Resources['LambdaCfnDispatchRole'].Condition = 'HasDispatchSnsArn';
}

module.exports.addDispatchSupport = addDispatchSupport;
