# function specification

## Common to all function definitions

- Only JavaScript based functions are currently supported.
- All functions must export the function definition in the `function.template.js` file using the `lambda-cfn.build` function. The bare minimum function definition is:
  ```javascript
  var lambdaCfn = require('@mapbox/lambda-cfn');

  module.exports = lambdaCfn.build({
      name: STRING_VALUE /* required */
  });
  ```
- The lambda-cfn `runtime` defaults to Node.js v10.x, Node.js v8.10, is also available. See [AWS Lambda execution environment](http://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html) for more information about the Lambda Node.js runtime environment.
- Lambda runtime parameters for `memorySize` and `timeout` are optional.
  - `memorySize` must a multiple of 64MB between 128MB and 1536MB. If not specified, the default is 128mb. If the value specified is out of bounds, Lambda-cfn will round to the nearest valid memorySize value.
  - `timeout` can be 0 to 300 seconds. If not specified, the default is 60 seconds. If the value specified is out of bounds, lambda-cfn will round to the nearest valid timeout value.

  ```javascript
  var lambdaCfn = require('@mapbox/lambda-cfn');

  module.exports = lambdaCfn.build({
      name: STRING_VALUE, /* required */
      runtime: 'nodejs10.x', /* optional, nodejs10.x (default) and nodejs8.10' */
      memorySize: '1536', /* in MB, optional, defaults to 128MB  */
      timeout: '300' /* in seconds, optional, defaults to 60 seconds */
  });
  ```
- Lambda-cfn creates sane IAM policy defaults, but if additional policies are necessary for the function they should be specified in the `statements` array.
- Example statement giving the function access to the AWS Support API:
  ```javascript
  var lambdaCfn = require('@mapbox/lambda-cfn');

  module.exports = lambdaCfn.build({
      name: STRING_VALUE, /* required */
      statements: [ /* optional */
          {
              Effect: 'Allow',
              Action: [
              'support:*'
              ],
              Resource: '*'
          }
      ]
  });
  ```
- By default, lambda-cfn expects and creates the directory structure below for Lambda functions. Based on this expectation, the `handler` for the Lambda function will be set to `myFunction/function.fn`.
  ```
  myProject/
  |-- package.json
  |-- myFunction/
    |-- function.js
    |-- function.template.js
  ```
  You can override this by specifying a `handler` parameter:
  ```javascript
  var lambdaCfn = require('@mapbox/lambda-cfn');

  module.exports = lambdaCfn.build({
      name: STRING_VALUE, /* required */
      handler: '<handlerDir>/<handlerName>.fn' /* optional, defaults to <functionDir>/function.fn */
  });
  ```

## Function parameters and environment variables

Any specified parameter is made available within the function process environment as an environment variable. If the parameter is named `someSecretKey` in the function definition, the value of the parameter will be available to the function code via `process.env.someSecretKey`.

- Parameters are optional, but if specified require both a `Type` and a `Description` property.
  ```javascript
  var lambdaCfn = require('@mapbox/lambda-cfn');

  module.exports = lambdaCfn.build({
      name: STRING_VALUE, /* required */
      parameters: { /* optional */
          STRING_VALUE: {
              Type: 'STRING_VALUE', /* required */
              Description: 'STRING_VALUE', /* required */
              },
          /* more parameters */
      }
  });
```
- Comma separated parameter values can be parsed within the function code with the built-in `lambdaCfn.splitOnComma` function, which will return an array of values from a comma delimited string. If `process.env.someParameter` is set to `value1,value2,value3,value4` then `splitOnComma(process.env.someParameter)` returns `['value1','value2','value3','value4']`.

## Lambda alarms

By default, CloudWatch alarms are configured to alarm after threshold of 1 or more errors happen over a period of 5 minutes. These values, `threshold`, `period`, and `evaluationPeriods` can be configured change how your function alarms. (For example, for non-critical stacks, setting the threshold to 3 will inform you that the [lambda could not do a successful retry](https://docs.aws.amazon.com/lambda/latest/dg/retries-on-errors.html).)

For more information on the definition of these values, please see the [CloudWatch documenation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html#alarm-evaluation).

Below is an example of a custom alarm policy:

```javascript
var lambdaCfn = require('@mapbox/lambda-cfn');

module.exports = lambdaCfn.build({
    name: STRING_VALUE, /* required */
    period: '120', /* in seconds, defaults to 60' */
    evaluationPeriods: '2', /* integer, defaults to 5  */
    threshold: '3' /* integer, defaults to 0 */
});
```
This would read that a CloudWatch alarm would be generated if three alarms were invoked in a four minute span. Note that this timespan is calculated by: `120 seconds X 2 periods = 240 seconds = 4 minutes`.

## Event source definitions

Lambda-cfn has built in support for four different event source types to invoke the function:
1. SNS events (`sns`)
2. CloudWatch filter event (`cloudwatchEvent`)
3. CloudWatch schedule event (`schedule`)
4. API Gateway (`webhook`)

These event sources are defined in the optional `eventSources` block. The SNS Topic event type is the default if no event source is specified.

Multiple event sources of the same type are not currently supported by lambda-cfn.

### CloudWatch filter event (`cloudwatchEvent`)

See [Using CloudWatch Events](http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/WhatIsCloudWatchEvents.html) for more information about AWS CloudWatch Events.

#### Example

```javascript
var lambdaCfn = require('@mapbox/lambda-cfn');

module.exports = lambdaCfn.build({
    name: 'STRING_VALUE', /* required */
    eventSources: { /* optional */
        cloudwatchEvent: {
            eventPattern: { // event pattern definition per AWS documentation
            }
        }
    }
});
```

#### Description

- `name`: Function name **Required.**
- `eventSources`: All event sources must be defined within the `eventSources` block
- `cloudwatchEvent`: Free-form JSON object pattern used by the rule to match events. **Required.** See [CloudWatch Events and Event Patterns](http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CloudWatchEventsandEventPatterns.html).

### CloudWatch scheduled event (`schedule`)

Scheduled rules are limited to a resolution of 5 minutes. The scheduled expression is not validated before rule creation. See [Schedule Expression Syntax for Rules](http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/ScheduledEvents.html) for details on the scheduled expression syntax.

#### Example

```javascript
var lambdaCfn = require('@mapbox/lambda-cfn');

module.exports = lambdaCfn.build({
    name: 'STRING_VALUE', /* required */
    eventSources: { /* optional */
        schedule: {
            expression: 'STRING_VALUE'
        }
    }
});
```

### Description

- `name`: Function name **Required.**
- `eventSources`: All event sources must be defined within the `eventSources` block
- `schedule`: creates a Cloudwatch scheduled event
- `expression`: A valid [CloudWatch Events schedule expression](http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/ScheduledEvents.html)

### SNS event (`sns`)

SNS events subscribe the lambda function to a unique SNS topic. Events pushed to the topic will trigger the lambda function and will pass the event payload directly to it. `lambda-cfn` creates a unique SNS topic for the function, and a unique access and secret key for it. The topic and access keys can found in the template output of the CloudFormation console, or with the `lambda-cfn` cli: `lambda-cfn info <environment>`

SNS events allow non-AWS sources to invoke the function, such as Github and Zapier. Due to limitations of Zapier, SNS event sources are granted the `listTopic` permission for the AWS account. For more information on SNS subscribed lambdas see [Invoking Lambda functions using Amazon SNS notifications](http://docs.aws.amazon.com/sns/latest/dg/sns-lambda.html).

#### Example

```javascript
var lambdaCfn = require('@mapbox/lambda-cfn');

module.exports = lambdaCfn.build({
    name: 'STRING_VALUE', /* required */
    eventSources: { /* optional */
        sns: {} // no configuration necessary, but requires an empty object, `{}`, to be valid JSON
    }
});
```

#### Description
- `name`: Function name **Required.**
- `eventSources`: All event sources must be defined within the `eventSources` block
- `sns`: Denotes an SNS subscribed rule. This should be left empty. **Required.**

### API Gateway (`webhook`)

The webhook event source setups and creates a publicly accessible REST endpoint using AWS API Gateway which can be used to trigger the function. Currently this event source type creates one endpoint that supports one HTTP method. The public endpoint for the function can be found in the template output. An API key is automatically created, and restricted to that stack and stage. The default stage created and deployed is named 'prod'.

The default output mapping outputs a 200 return code for everything but return values matching "Error" or "Exception", which are mapped to 500.

The webhook event source supports definition of the [method responses]( http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-apitgateway-method-methodresponse.html) as well as the definition of the entire [method integration]( http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-apitgateway-method-integration.html). The method integration is quite complex but lambda-cfn provides safe defaults when possible.

For simple webhook triggered events, the example template should suffice.

#### Example

```javascript
var lambdaCfn = require('@mapbox/lambda-cfn');

module.exports = lambdaCfn.build({
    name: 'STRING_VALUE', /* required */
    eventSources: {
        webhook: {
            method: 'POST', /* required */
            apiKey: false, /* optional, defaults to false */
            methodResponses: [],  /* optional, see below for defaults if not specified */
            integration: {} /* optional, see below for defaults if not specified */
        }
    }
});
```

#### Description

- `name`: function name **Required**
- `eventSources`: All event sources must be defined within the `eventSources` block
- `webhook`: Denotes a rule with a publicly accessible REST endpoint **Required**
- `method`: GET|PUT|POST|PATCH|DELETE|HEAD|OPTIONS  Client HTTP method
- `apiKey`: true|false Client request must use stack's [API key](http://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-api-keys.html)
- `methodResponses`: an array of JSON definitions for the [method response mapping](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-apitgateway-method-methodresponse.html)
- `integration`: the [method integration](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-apitgateway-method-integration.html) definition

#### Integration and method response defaults

Integration default configuration:
```javascript
{
    Type: 'AWS',
    IntegrationHttpMethod: 'POST',
    Uri: cf.join(['arn:aws:apigateway:', cf.region, ':lambda:path/2015-03-31/functions/',cf.getAtt(options.name, 'Arn'), '/invocations']),
    IntegrationResponses: [
        {
            StatusCode: '200'
        },
        {
            StatusCode: '500',
            SelectionPattern: '^(?i)(error|exception).*'
        }
    ]
}
```

Method response default configuration:
```javascript
[
    {
        StatusCode: '200',
        ResponseModels: {
            'application/json': 'Empty'
        }
    },
    {
        StatusCode: '500',
        ResponseModels: {
            'application/json': 'Empty'
        }
    }
],
```

### Complex `webhook` configuration

This example shows how to configure the method integration to accept a post body that is url encoded, which API Gateway does not natively support. The request template maps any request of `x-www-form-urlencoded` type and wraps the request in JSON which allows API Gateway to continue processing the request.

```javascript
  eventSources: {
    webhook: {
      method: 'POST',
      apiKey: false,
      integration: {
        PassthroughBehavior: 'WHEN_NO_TEMPLATES',
        RequestTemplates: {
          'application/x-www-form-urlencoded': '{ "postBody" : $input.json("$")}'
        }
      }
    },
  }
```
