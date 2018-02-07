# Change Log
All notable changes to this project will be documented in this file. For change log formatting, see http://keepachangelog.com/

## Unreleased
- updated contrib docs to include instructions to update tests for new releases

## 3.0.0 2018-02-07
- Drop node 4.3.2 support.
- Transition to ES6.
- Add integration with [Dispatch](https://github.com/mapbox/dispatch).
- Major refactoring

## 2.0.1 2017-08-22
- Fixes template Outputs bug when enabling an API key on a webhook function.

## 2.0.0 2017-08-15
- Complete refactor of the lambda-cfn codebase to increase usability as well as simplify deployments. Lambda-cfn now maps a single function to a single CloudFormation stack.
- New command line `lambda-cfn` binary fully supports all `cfn-config` options and adds sane and helpful defaults to simplify deploying functions
- Lambda-cfn function definitions now use better naming, and have support for more flexible event source configuration. Please read the [FUNCTION-SPEC.md]() for the revised definitions.
- API Gateway (webhook) event source rewritten to include configuration support for the entire method integration.

## 1.0.0 2017-04-27
- Removed all dependencies on  [streambot](https://github.com/mapbox/streambot)
- Enabled native environment variables in Lambda
- Functions given to Lambda-cfn should now use the official [AWS Lambda Programming Model](http://docs.aws.amazon.com/lambda/latest/dg/programming-model.html) for their selected version of Node.

## 0.1.5 2016-12-9
- Enabled Node 4.3.2 runtime support
- Allows for configurable runtime - `nodejs` or `nodejs4.3`

## 0.1.4 2016-06-06
- Randomized API deployment name so methods are redeployed on every update.

## 0.1.3 2016-05-06
- Fixed API GW method response error mapping

## 0.1.1 2016-05-05
- Fixed building roles from statements defined within rules
- Corrected false non-falsey return values being returned in `getEnv()` and `splitOnComma()`

## 0.1.0 2016-05-02
- API Gateway rule support

## 0.0.10 2016-04-22
- Uses newly released CFN support for Cloudwatch Event Rules
- Update from `queue-async` to `d3-queue`
- Removed lambda-rules binary
- Rules are namespaced with their repository name
- Parameters are namespaced with repository name and rule name
- version incremented for bad v0.0.9 npm release

## 0.0.9 2016-04-21
- Not for use, published version is broken

## 0.0.8 2016-04-08

### Added
- SNS topic name added to template output to ease configuring snsRules

### Fixed
- Outputs were not being included in final template output
