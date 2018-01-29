const path = require('path');
const cf = require('@mapbox/cloudfriend');

const DEFAULT_LAMBDA_SETTINGS = {
  RUNTIME: 'nodejs6.10',
  MEMORY_SIZE: 128,
  TIMEOUT: 60
};

/**
 * Build configuration for lambda
 * This function creates
 *
 * - A lambda function and attach a role to it.
 *
 * @param options
 * @returns {{Resources: {}}}
 */
function buildLambda(options) {
  // crawl the module path to make sure the Lambda handler path is
  // set correctly: <functionDir>/function.fn
  let handlerPath = (module.parent.parent.parent.filename).split(path.sep).slice(-2).shift();
  let fn = {
    Resources: {}
  };

  // all function parameters available as environment variables
  fn.Resources[options.name] = {
    Type: 'AWS::Lambda::Function',
    Properties: {
      Code: {
        S3Bucket: cf.ref('CodeS3Bucket'),
        S3Key: cf.join([cf.ref('CodeS3Prefix'), cf.ref('GitSha'), '.zip'])
      },
      Role: cf.if('HasDispatchSnsArn', cf.getAtt('LambdaCfnDispatchRole', 'Arn'), cf.getAtt('LambdaCfnRole', 'Arn')),
      Description: cf.stackName,
      Environment: {
        Variables: {}
      },
      Handler: handlerPath + '/function.fn'
    }
  };

  fn.Resources[options.name].Properties.Timeout = setLambdaTimeout(options.timeout);
  fn.Resources[options.name].Properties.MemorySize = setLambdaMemorySize(options.memorySize);
  fn.Resources[options.name].Properties.Runtime = setLambdaRuntine(options.runtime);

  return fn;
}

function setLambdaTimeout(timeout) {
  if (timeout <= 300 && timeout > 0) {
    return timeout;
  }

  if (timeout > 300) {
    return 300;
  }

  return DEFAULT_LAMBDA_SETTINGS.TIMEOUT;
}

function setLambdaMemorySize(memorySize) {
  if (memorySize >= 128 && memorySize <= 1536) {
    return memorySize - (memorySize % 64);
  }

  if (memorySize > 1536) {
    return 1536;
  }

  return DEFAULT_LAMBDA_SETTINGS.MEMORY_SIZE;
}

function setLambdaRuntine(runtime) {
  if (!runtime) {
    return DEFAULT_LAMBDA_SETTINGS.RUNTIME;
  }

  let validRuntimes = ['nodejs4.3', 'nodejs6.10'];
  if (validRuntimes.indexOf(runtime) === -1) {
    throw new Error(`Invalid AWS Lambda node.js runtime ${runtime}`);
  }
  return runtime;
}

module.exports.buildLambda = buildLambda;
