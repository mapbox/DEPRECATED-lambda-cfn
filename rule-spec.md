# Rule Specification
## Common to all rules
- All rules must be exported for lambda-cfn to wrap them correctly.
```javascript
module.exports.config = {
	RULE_DEFINITION
};
```
- Rule `name` must be unique across all rules imported into a single Crowsnest stack.
- Lambda runtime parameters for memory size and timeout are set per rule. The `memorySize` and `timeout` parameters are optional. Memory size must a multiple of 64MB between 128MB and 1536MB, and timeout cannot be greater than 300 seconds. Lambda-cfn uses a default of 128MB and 60 seconds if not specified.
```javascript
module.exports.config = {
	name: 'STRING_VALUE',
	memorySize: 512,
	timeout: 240
	...
};
```

## CloudWatch Event rule
Cloudwatch Event rules support triggering the lambda with a CloudWatch Events filter or a scheduled CloudWatch event. A rule definition can specify either `eventRule` or `scheduledRule`, or both, if you want the rule to fire on a schedule and on an event filter, but at least one must be present.

See http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/WhatIsCloudWatchEvents.html for more information about filters.

Scheduled rules are limited to a resolution of 5 minutes. Currently the schedule expression is not validated prior to rule creation. See http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/ScheduledEvents.html for detail on the scheduled expression syntax.

#### Example
```javascript
module.exports.config = {
  name: 'STRING_VALUE', 			/* required */
  parameters: {
    'STRING_VALUE': {
      'Type': 'STRING_VALUE',
      'Description': 'STRING_VALUE',
    }
  },
  eventRule: {						/* required */
    eventPattern: {					/* required */
		JSON_VALUE
    }
  },
  scheduledRule: 'SCHEDULE_EXPRESSION'
};
```
#### Description
`name`: Rule name, must be unique across all included rules. **Required.**
`parameters`: CloudFormation parameters passed into the lambda as environment variables by Streambot. **Optional.**
`eventRule`/`scheduledRule`: Denotes a CloudWatch Events driven rule.** At least one required.**
`eventPattern`: Free-form JSON object pattern used by the rule to match events. **Required.** See http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CloudWatchEventsandEventPatterns.html
`SCHEDULE_EXPRESSION`: Valid CloudWatch Events schedule expression


## SNS subscribed rule
SNS rules subcribe the lambda to a unique SNS topic. Events pushed to the topic will trigger the lambda and will pass the event payload directly to the lambda. LambdaCFN creates a unique SNS topic for each SNS rule, and each topic has a unique access key and secret key generated for it. SNS rules allow the integration of non-AWS event sources into Crowsnest, such as Github and Zapier. Due to a limitation of Zapier, rules of this type are granted the 'listTopic' permission for the AWS account. For more information on SNS subscribed lambdas see http://docs.aws.amazon.com/sns/latest/dg/sns-lambda.html

#### Example
```javascript
module.exports.config = {
  name: 'STRING_VALUE', 			/* required */
  parameters: {
    'STRING_VALUE': {
      'Type': 'STRING_VALUE',
      'Description': 'STRING_VALUE',
    }
  },
  snsRule: {} 						/* required */
};
```
#### Description
`name`: Rule name, must be unique across all included rules.** Required.**
`parameters`: CloudFormation parameters passed into the lambda as environment variables by Streambot. **Optional.**
`snsRule`: Denotes a SNS subscribed rule. This should be left empty. **Required.**


