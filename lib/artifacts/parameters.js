function buildParameters(options) {
  let parameters = {
    Parameters: {}
  };

  if (options.parameters) {
    validParameters((options.parameters));
    parameters.Parameters = options.parameters;
  }

  parameters.Parameters.CodeS3Bucket = {
    Type: 'String',
    Description: 'lambda function S3 bucket location'
  };
  parameters.Parameters.CodeS3Prefix = {
    Type: 'String',
    Description: 'lambda function S3 prefix location'
  };
  parameters.Parameters.GitSha = {
    Type: 'String',
    Description: 'Deploy Gitsha'
  };

  return parameters;
}

function validParameters(parameters) {
  for (let param in parameters) {
    let isAlphaNumeric = /^[a-zA-Z0-9]+$/.test(param);
    if (!isAlphaNumeric) {
      throw new Error('Parameter names must be alphanumeric');
    }

    if (!parameters[param].Type) {
      throw new Error('Parameter must contain Type property');
    }

    if (!parameters[param].Description) {
      throw new Error('Parameter must contain Description property');
    }
  }
}

module.exports.buildParameters = buildParameters;
