const path = require('path');
const cf = require('@mapbox/cloudfriend');

const DEFAULT_LAMBDA_SETTINGS = {
  RUNTIME: 'nodejs6.10',
  MEMORY_SIZE: 128,
  TIMEOUT: 60
};

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

  fn.Resources[options.name].Properties.Timeout = DEFAULT_LAMBDA_SETTINGS.TIMEOUT;
  if (options.timeout) {
    fn.Resources[options.name].Properties.Timeout = normalizeTimeout(options.timeout);
  }

  fn.Resources[options.name].Properties.MemorySize = DEFAULT_LAMBDA_SETTINGS.MEMORY_SIZE;
  if (options.memorySize) {
    fn.Resources[options.name].Properties.MemorySize = normalizeMemorySize(options.memorySize);
  }

  fn.Resources[options.name].Properties.Runtime = DEFAULT_LAMBDA_SETTINGS.RUNTIME;
  if (options.runtime) {
    let validRuntimes = ['nodejs4.3', 'nodejs6.10'];
    if (validRuntimes.indexOf(options.runtime) === -1) {
      throw new Error('Invalid AWS Lambda node.js runtime ' + options.runtime);
    } else {
      fn.Resources[options.name].Properties.Runtime = options.runtime;
    }
  }

  return fn;
}

function normalizeTimeout(timeout) {
  if (timeout <= 300 && timeout > 0) {
    return timeout;
  }

  if (timeout > 300) {
    return 300;
  }

  return DEFAULT_LAMBDA_SETTINGS.TIMEOUT;
}

function normalizeMemorySize(memorySize) {
  if (memorySize >= 128 && memorySize <= 1536) {
    return memorySize - (memorySize % 64);
  }

  if (memorySize > 1536) {
    return 1536;
  }

  return DEFAULT_LAMBDA_SETTINGS.MEMORY_SIZE;
}

module.exports.buildLambda = buildLambda;
