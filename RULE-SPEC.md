# Patrol rule specification
## Common to all rules
- JavaScript based rule functions only
- Runs on Node.js v0.10.36 per the [AWS Lambda execution environment](http://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html)
- All rules must export a `config` object and a `fn` function for `lambda-cfn` to wrap them correctly.

	```javascript
	module.exports.config = {
		name: STRING_VALUE, /* required */
		memorySize: INTEGER,
		timeout: INTEGER,
		parameters: {
			/* RULE_PARAMETERS */
		},
                statements: [
                  {
                    Effect: 'Allow',
                    Action: [
                      's3:GetObject'
                    ],
                    Resource: 'arn:aws:s3:::mySuperDuperBucket'
                  }
                ]
		/* RULE_DEFINITION */
	};
	module.exports.fn = function(event,callback) {
		/* RULE_FUNCTION */
	};
	```

- The rule's `name` in the `config` property must be unique across all rules imported into a single patrol stack, see [issue #15](https://github.com/mapbox/lambda-cfn/issues/15).
- Lambda runtime parameters for `memorySize` and `timeout` are set per rule and are optional.
    - `memorySize` must a multiple of 64MB between 128MB and 1536MB. If not specified, the default is 128mb.
    - `timeout` can be 0 to 300 seconds. If not specified, the default is 60 seconds.
- `statements` is an optional array of IAM policy statements which will be added to the Lambda IAM role.  If your Lambda function requires additional AWS API access, specify it here.

## Environment variables and rule parameters
- Environment variables are passed to the AWS Lambda function's for a patrol rule via CloudFormation template parameters that are sent to a running instance of [streambot](http://github.com/mapbox/streambot).
- Environment variables can be accessed within a patrol rule via the `process.env` object.
- Parameters are optional, but if specified require both a `Type` and a `Description` property.

    ```javascript
	parameters: {
		'STRING_VALUE': {
			'Type': 'STRING_VALUE', /* required */
			'Description': 'STRING_VALUE', /* required */
		},
		/* more items */
	}
    ```
- Parameter namespace is global across all included rule sets, see [issue #6](https://github.com/mapbox/lambda-cfn/issues/6).
- AWS Lambda does not natively support passing CloudFormation parameters to lambdas on startup, so [`streambot`](http://github.com/mapbox/streambot) is used to populate the lambda `process.env` with the parameters.


## Rule definitions
### CloudWatch Event rule
Cloudwatch Event rules support triggering the patrol rule's Lambda function with a CloudWatch Event (`eventRule`) or a scheduled CloudWatch Event (`scheduledRule`). A rule definition can specify an `eventRule`, a `scheduledRule`, or both. If you want the rule to fire on a schedule and on an event filter, but at least one must be present.

See [Using CloudWatch Events](http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/WhatIsCloudWatchEvents.html) for more information about AWS CloudWatch Events.

Scheduled rules are limited to a resolution of 5 minutes. The scheduled expression is not validated before rule creation. See [Schedule Expression Syntax for Rules](http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/ScheduledEvents.html) for details on the scheduled expression syntax.

#### Example
```javascript
module.exports.config = {
  name: 'STRING_VALUE', 			/* required */
  },
  eventRule: {
    eventPattern: {
		JSON_VALUE
    }
  },
  scheduledRule: 'SCHEDULE_EXPRESSION'
};
```
#### Description
* `name`: Rule name, must be unique across all included rules. **Required.**
* `eventRule`,`scheduledRule`: Denotes a CloudWatch Events driven rule. **At least one event type is required.**
* `eventPattern`: Free-form JSON object pattern used by the rule to match events. **Required.** See [CloudWatch Events and Event Patterns](http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CloudWatchEventsandEventPatterns.html).
* `scheduledRule`: A valid [CloudWatch Events schedule expression](http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/ScheduledEvents.html)

### SNS subscribed rule
SNS rules subscribe the lambda function to a unique SNS topic. Events pushed to the topic will trigger the lambda function and will pass the event payload directly to it. `lambda-cfn` creates a unique SNS topic for each SNS rule, and each topic has a unique access and secret key generated for it, found in the template output of the CloudFormation console.

SNS rules allow the integration of non-AWS event sources into Patrol, such as Github and Zapier. Due to  limitations of Zapier, rules of this type are granted the `listTopic` permission for the AWS account. For more information on SNS subscribed lambdas see [Invoking Lambda functions using Amazon SNS notifications](http://docs.aws.amazon.com/sns/latest/dg/sns-lambda.html).

#### Example
```javascript
module.exports.config = {
  name: 'STRING_VALUE', 			/* required */
  snsRule: {} 						/* required */
};
```
#### Description
* `name`: Rule name, must be unique across all included rules. **Required.**
* `snsRule`: Denotes an SNS subscribed rule. This should be left empty. **Required.**

## Rule functions
- `lambda-cfn` binds the function to the Lambda function's `index.RULE_NAME` handler.
- Event payloads are passed to the handler unmodified.
- When creating a rule that is both event and schedule triggered, the function should first detect the Cloudwatch Event object type (`eventRule` or `scheduledRule`), and act accordingly as schedule and filter event payloads are different.
- All Lambda functions are wrapped by [`streambot`](http://github.com/mapbox/streambot), and the callback uses the familiar node.js style format of `(err,result)`.
- The AWS Lambda `context` is bound to the Streambot'ed function as per [pull request #36](https://github.com/mapbox/streambot/pull/36) on streambot.
