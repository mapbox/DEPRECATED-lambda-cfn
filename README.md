:warning: DEPRECATED :warning:

# lambda-cfn

[![Build Status](https://travis-ci.org/mapbox/lambda-cfn.svg?branch=master)](https://travis-ci.org/mapbox/lambda-cfn) [![npm](https://img.shields.io/npm/v/@mapbox/lambda-cfn.svg)](https://www.npmjs.com/package/@mapbox/lambda-cfn)

Quickly create, deploy, and manage AWS Lambda functions via AWS CloudFormation.

## Prerequisites

### Node.js

Lambda-cfn (or "Lambda CloudFormation") is a Node.js project that runs on AWS Lambda. Node.js v10.x is the current default, Node.js v8.10 is also available. See [AWS Lambda execution environment](http://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html) for more information about the Lambda Node.js runtime environment.

### S3 buckets

Lambda-cfn uses [cfn-config](https://github.com/mapbox/cfn-config) behind the scenes to create and manage CloudFormation stacks. Cfn-config requires two S3 buckets - a config bucket and a template bucket - to work.

Lambda-cfn will look for the following buckets by default if you've set an `AWS_ACCOUNT_ID` environment variable:

- Config bucket: `cfn-configs-$AWS_ACCOUNT_ID-region`
- Template bucket: `cfn-config-templates-$AWS_ACCOUNT_ID-region`

For example, if your AWS account ID is `123456789` and you're using the `us-west-1` region then lambda-cfn will look for buckets named `cfn-configs-123456789-us-west-1`and `cfn-config-templates-123456789-us-west-1`.

If you don't want to use the default naming convention then you'll need to pass both bucket names as arguments for the `create`, `update`, and `save` commands. You can also set a `CFN_CONFIG_BUCKET` environment variable if you'd prefer.

## Installation

First install lamdba-cfn globally so that you can use lambda-cfn utility commands like `lambda-cfn init` or `lambda-cfn create`:

```
npm install -g @mapbox/lambda-cfn
```

## Creating new Lambda functions

After installing lambda-cfn, from within your project directory (e.g. `myProject`) run the following command:

```
lambda-cfn init <function name>
```

For example, running `lambda-cfn init myFunction` will create the following files and directories:

- a `package.json` file in the currently working directory with `lambda-cfn` as a dependency
- a `myFunction` directory, with two files called `function.js` and `function.template.js`

This looks like:

```
myProject/
|-- package.json
|-- myFunction/
  |-- function.js
  |-- function.template.js
```

You can have multiple function directories with the main project directory (`myProject`).

```
myProject/
|-- package.json
|-- myFunction/
  |-- function.js
  |-- function.template.js
|-- myOtherFunction/
  |-- function.js
  |-- function.template.js
```

### `function.js`

Add the code for your Lambda function to this file. We have already taken care of setting up the handler function for you. Here's what this file looks like:

```js
var lambdaCfn = require('@mapbox/lambda-cfn');

module.exports.fn = function(event, context, callback) {
  // write Lambda function code here

};
```

### `function.template.js`

Configure your Lambda function in this file. Configuration consists of passing in a JavaScript object to the `lambdaCfn.build()` function. Lambda-cfn will take care of generating the CloudFormation template for you as part of the deployment process.

Here's what the `function.template.js` file looks like after running `lambda-cfn init`. The only required property for deployment is the name of the function - all other properties are optional.

```js
const lambdaCfn = require('@mapbox/lambda-cfn');

module.exports = lambdaCfn.build({
  name: 'myFunction'
});
```

If you'd like to create a Lambda function that runs on the older Node.js 8.10 runtime with a memory size of 256 MB and a timeout of 120 seconds:

```js
const lambdaCfn = require('@mapbox/lambda-cfn');

module.exports = lambdaCfn.build({
  name: 'myFunction',
  runtime: 'nodejs8.10',
  memorySize: '256',
  timeout: '120'
});
```

For a full list of available function properties to configure your Lambda function, see the [function specification documentation](FUNCTION-SPEC.md).

## Deploying Lambda functions to AWS

First we'll need to zip up the code for our Lambda function and then upload it to S3 before we can deploy it via CloudFormation. We also need to make sure that our project and its functions are within a git repository. Run `git init` to set this up.

### Use of cfn-config

Lambda-cfn uses [cfn-config](https://github.com/mapbox/cfn-config) for creating, retrieving, updating, and deleting CloudFormation stacks. It takes the same parameters and values as cfn-config, see the [cfn-config CLI usage documentation](https://github.com/mapbox/cfn-config#cli-usage).

Lambda-cfn will look for the following environment variables if you'd prefer to not pass in flags for each command:

- `CFN_CONFIG_BUCKET` for `--config-bucket` (`-c`)
- `AWS_REGION` for `--region` (`-r`)

To get a full list of lambda-cfn commands, run `lambda-cfn --help`.

### Uploading your code to S3

By default lambda-cfn expects your Lambda code to be in the following location on S3:

`s3://<your bucket>/<optional prefixes>/<gitsha>.zip`

We created a Bash script called `upload.sh` within lambda-cfn that will do this for you. The script obtains the current gitsha, zips up the code, copies it to S3, then deletes the zip file.

Run this script from the parent directory (`myProject` or the one with the `package.json` file). You'll need to provide the path to your S3 bucket and any prefixes, **without the trailing slash**:

```sh
sh upload.sh <bucket>/<optional prefixes>
```

If I'm using bucket `myBucket` and the prefix `myFunction`:

```sh
sh upload.sh myBucket/myFunction
```

This will upload your code to `s3://myBucket/myFunction/<gitsha>.zip`.

If you'd like to manually upload your code, then zip your entire project directory (`myProject` or the parent directory containing the `package.json` file) and copy it to S3 to the location of your choice. You can provide the location of your code during the `lambda-cfn create` command in the next step.

### Creating the CloudFormation stack

To create a new CloudFormation stack for your lambda function, run `lambda-cfn create <environment name>`. For example, if I want to create to a development environment stack in the default `us-east-1` region:

```
lambda-cfn create dev
```

This will use the default config and template S3 buckets mentioned in the prerequisites. If you'd like to override these buckets and deploy to `us-west-1`:

```
lambda-cfn create dev --region us-west-1 --config-bucket <config bucket> --template-bucket <template bucket>
```

CloudFormation stacks created by lambda-cfn have the following naming convention:

```
<project directory name>-<function directory name>-<environment name>
```

If my project directory is named `myProject` and I'm creating a stack for the `myFunction` function, then my stack's CloudFormation name is `myProject-myFunction-dev`.

CloudFormation stack names must start with a letter and may only contain letters, numbers, or hyphens. Lambda-cfn will warn you if you try to use an invalid name.

### Providing parameter values

After running `lambda-cfn create`, you'll be prompted to provide four values: `CodeS3Bucket`, `CodeS3Prefix`, `GitSha`, and `ServiceAlarmEmail`. The first two correspond to the S3 bucket and optional prefix to where you uploaded your code. **Note: you must leave a trailing forward slash (`/`) at the end of your prefix**. Lambda-cfn will also automatically detect the current gitsha of your project and use that for the filename for the zip file. You are not required to use the gitsha though - feel free to override this with the name of your zip file if you uploaded the file manually:

For example, if I used the `upload.sh` script to upload the file to `s3://myBucket/myFunction/<gitsha>.zip`, then I'd use the following information in the parameter prompt:

- `CodeS3Bucket` = `myBucket`
- `CodeS3Prefix` = `myFunction/`
- `GitSha` = accept the default value (press enter)

For the service alarm email you can use any email address that you'd like under your control.

### Getting information on a CloudFormation stack

Run the `lambda-cfn info` command. This is the same as the `cfn-config info` command. Make sure to specify the same region to which you deployed, either via a flag (`--region`) or via the `AWS_REGION` environment variable. By default lambda-cfn will look in `us-east-1`:

```
lambda-cfn info dev -r us-west-1
```

### Updating a CloudFormation stack

```
lambda-cfn update dev -r us-west-1
```

### Deleting a CloudFormation stack

```
lambda-cfn delete dev -r us-west-1
```

### Saving CloudFormation stacks

Saving a CloudFormation stack allows you to reuse the parameter values for later, even if you later delete the stack.

```
lambda-cfn save dev
```

## How do I contribute?

We're happy you want to contribute! Check out [CONTRIBUTING.MD](CONTRIBUTING.MD) for more information.

## Utilities

`capitalizeFirst`: Capitalize the first word of a string.

`splitOnComma`: Creates an array from a list of words.

## Dispatch Integration

lambda-cfn now supports Mapbox's alert router [Dispatch](https://github.com/mapbox/dispatch) which provides integration service with Github, Slack, and PagerDuty on lambda-cfn version 3.0 or higher. By default, lambda-cfn will have an optional parameter for your dispatch stack SNS Topic ARN. If specified, lambda-cfn will grant the function permission to publish to that SNS Topic.

`lib/message.js` will route your message to Dispatch is `DispatchSnsArn` environment variable is set.

### How to use it?

Import the utility functions like this:

```javascript
const lambdaCfn = require('@mapbox/lambda-cfn');

const dispatchMessage = {
    type: 'high-priority',
    pagerDutyServiceId: 'TEST123',
    body: {
      pagerduty: {
        service: 'TEST123',
        title: 'LambdaCfn is awesome!',
        body: 'It routed this message through the power of dispatch!'
      }
    }
};

lambdaCfn.message(dispatchMessage, (err, res) => {
  if (err) console.error(err);
  console.log(res);
});

```

## Questions?

[Open new issue in this repo](https://github.com/mapbox/lambda-cfn/issues).
