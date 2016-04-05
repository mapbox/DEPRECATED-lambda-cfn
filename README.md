# lambda-cfn

[![Build Status](https://travis-ci.org/mapbox/lambda-cfn.svg?branch=master)](https://travis-ci.org/mapbox/lambda-cfn)

Quickly define Lambda functions and supporting resources via a javascript CloudFormation template.

## Synopsis

In a file named like `myTemplate.template`:

```
var lambdaCfn = require('lambda-cfn');

module.exports = lambdaCfn(
  [
    'myHandler.js',
  ],
  {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Description": "my stack"
  }
);
```

where in `myHandler.js` you've exported:

- module.exports.fn - a function which is wrapped by [streambot](git@github.com:mapbox/streambot.git) and which will get called by Lambda.  Steambot is used for [runtime configuration](https://github.com/mapbox/streambot#runtime-configuration) which is able to be defined in module.exports.config
- module.exports.config - allows you to define some configuration for your Lambda function.  See the [rules spec](https://github.com/mapbox/lambda-cfn/blob/readme/RULE-SPEC.md) for all options.

After uploading a zip of your project to a location in Lambda, you can then deploy this javascript CloudFormation template with [cfn-config](https://github.com/mapbox/cfn-config#usage-1) to deploy your function.

See the [patrol](https://github.com/mapbox/patrol) README for more examples.

## Why

[AWS Lambda](http://aws.amazon.com/lambda/) simplifies deploying code on AWS by eliminating the need to run EC2s.  However, you still need to:

- Monitor the function and know when it fails
- Grant the function proper IAM policy permissions
- Schedule the function, or connect it to an event source
- Capture all of this in a CloudFormation template

lambda-cfn provides for a simplified interface for defining all of the above, and when used in combination with [cfn-config](https://github.com/mapbox/cfn-config), offers a command line interface for deploying and updating the CloudFormation template in which your lambda functions and supporting resources are captured.

Instead of directly writing a CloudFormation template, cfn-config is able to read a javascript file, and, if that javascript file implements lambda-cfn, cfn-config + lambda-cfn turn that file into a valid CloudFormation template.

lambda-cfn adheres to a [rules spec](https://github.com/mapbox/lambda-cfn/blob/master/RULE-SPEC.md) in order for a Lambda function, supporting resources, and configuration to be defined in javascript files, which can then be expanded into CloudFormation template JSON.

## Basic use

Refer to the [patrol](https://github.com/mapbox/patrol) README, and especially its "getting started" guide for an example usage of lambda-cfn.
