# lambda-cfn

[![Build Status](https://travis-ci.org/mapbox/lambda-cfn.svg?branch=master)](https://travis-ci.org/mapbox/lambda-cfn)

Quickly define Lambda functions and supporting resources via a CloudFormation template.

## Overview

[AWS Lambda](http://aws.amazon.com/lambda/) simplifies deploying code on AWS by eliminating the need to run EC2s.  However, you still need to:

- Monitor the function and know when it fails
- Grant the function proper IAM policy permissions
- Schedule the function, or connect it to an event source
- Capture all of this in a CloudFormation template

lambda-cfn provides for a simplified interface for defining all of the above, and when used in combination with [cfn-config](https://github.com/mapbox/cfn-config), offers a command line interface for deploying and updating the CloudFormation template in which your lambda functions and supporting resources are captured.

Instead of directly writing a CloudFormation template, cfn-config is able to read a javascript file, and, if that javascript file implements lambda-cfn, cfn-config + lambda-cfn turn that file into a valid CloudFormation template.

lambda-cfn adheres to a [rules spec](https://github.com/mapbox/lambda-cfn/blob/master/RULE-SPEC.md) in order for a Lambda function, supporting resources, and configuration to be defined in javascript files, which can then be expanded into CloudFormation template JSON.

## Basic use

Refer to the [crowsnest](https://github.com/mapbox/crowsnest) README, and especially its "getting started" guide for an example usage of lambda-cfn.
