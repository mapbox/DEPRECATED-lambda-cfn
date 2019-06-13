const path = require('path');
const cf = require('@mapbox/cloudfriend');

const DEFAULT_LAMBDA_SETTINGS = {
  RUNTIME: 'nodejs10.x',
  MEMORY_SIZE: 128,
  TIMEOUT: 60
};

/**
 * Build configuration for lambda
 * This function creates
 *
 * - A lambda function
 *
 * @param options
 * @returns {{Resources: {}}}
 */
function buildLambda(options) {
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
      }
    }
  };

  fn.Resources[options.name].Properties.Timeout = setLambdaTimeout(options.timeout);
  fn.Resources[options.name].Properties.MemorySize = setLambdaMemorySize(options.memorySize);
  fn.Resources[options.name].Properties.Runtime = setLambdaRuntine(options.runtime);
  fn.Resources[options.name].Properties.Handler = setLambdaHandler(options.handler);

  return fn;
}

function setLambdaTimeout(timeout) {
  if (timeout <= 900 && timeout > 0) {
    return timeout;
  }

  if (timeout > 900) {
    return 900;
  }

  return DEFAULT_LAMBDA_SETTINGS.TIMEOUT;
}

function setLambdaMemorySize(memorySize) {
  if (memorySize >= 128 && memorySize <= 3008) {
    return memorySize - (memorySize % 64);
  }

  if (memorySize > 3008) {
    return 3008;
  }

  return DEFAULT_LAMBDA_SETTINGS.MEMORY_SIZE;
}

function setLambdaRuntine(runtime) {
  if (!runtime) {
    return DEFAULT_LAMBDA_SETTINGS.RUNTIME;
  }

  let validRuntimes = ['nodejs8.10', 'nodejs10.x'];
  if (validRuntimes.indexOf(runtime) === -1) {
    throw new Error(`Invalid AWS Lambda node.js runtime ${runtime}`);
  }
  return runtime;
}

function setLambdaHandler(handler) {
  if (!handler) {
    // crawl the module path to make sure the Lambda handler path is
    // set correctly: <functionDir>/function.fn
    let handlerPath = (module.parent.parent.parent.filename).split(path.sep).slice(-2).shift();
    return handlerPath + '/function.fn';
  }

  return handler;
}

module.exports.buildLambda = buildLambda;
