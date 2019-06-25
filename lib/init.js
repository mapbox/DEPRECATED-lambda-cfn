const fs = require('fs');
const path = require('path');
const d3 = require('d3-queue');

function checkPackageJson(callback) {
  let directoryName = path.basename(process.cwd());
  let files = fs.readdirSync(process.cwd());
  /* eslint-disable quotes */
  let content = {
    "name": directoryName,
    "version": "0.0.0",
    "dependencies": {
      "@mapbox/lambda-cfn": "^3.1.0"
    }
  };
  /* eslint-enable quotes */

  if (files.indexOf('function.js') !== -1) {
    return callback('ERROR: init called within existing function directory, unsupported behavior, exiting');
  }
  if (files.indexOf('package.json') === -1) {
    fs.writeFile('package.json', JSON.stringify(content, null, 2), 'utf8', function(err) {
      if (err) return callback(err);
      return callback(null, 'Created package.json file');
    });
  } else {
    fs.readFile('package.json', function(err, data) {
      if (err) return callback(err);
      let packageFile = JSON.parse(data);
      if ('@mapbox/lambda-cfn' in packageFile.dependencies) {
        packageFile.dependencies['@mapbox/lambda-cfn'] = content.dependencies['@mapbox/lambda-cfn'];
        fs.writeFile('package.json', JSON.stringify(packageFile, null, 2), function(err){
          if (err) return callback(err);
          return callback(null, 'Package.json @mapbox/lambda-cfn dependency updated to ' + content.dependencies['@mapbox/lambda-cfn']);
        });
      } else {
        packageFile.dependencies['@mapbox/lambda-cfn'] = content.dependencies['@mapbox/lambda-cfn'];
        fs.writeFile('package.json', JSON.stringify(packageFile, null, 2), function(err){
          if (err) return callback(err);
          return callback(null, 'Added @mapbox/lambda-cfn ' + content.dependencies['@mapbox/lambda-cfn'] + ' as a dependency to existing package.json');
        });
      }
    });
  }
}

// TODO: overhaul this with promises to make managing the async
// file writes a bit easier to deal with
function createFunctionFiles(name, callback) {
  const regExp = /^[a-zA-Z][a-zA-Z0-9-]+$/;
  let q = d3.queue(1);

  if (!name.match(regExp)) {
    return callback('Not a valid AWS CloudFormation stack name - must contain only letters, numbers, dashes and start with an alpha character');
  }

  fs.mkdir(name, function(err) {
    if (err) {
      if (err.code !== 'EEXIST') {
        return callback(err);
      }
    }
    process.chdir(name);
    let files = fs.readdirSync(process.cwd());
    if (files.indexOf('function.js') === -1) {
      let functionJsContent = 'var lambdaCfn = require(\'@mapbox/lambda-cfn\');\n\n'
            + 'module.exports.fn = function(event, context, callback) {\n'
            + '// write Lambda function code here\n\n};';
      q.defer(fs.writeFile, 'function.js', functionJsContent);
    }
    if (files.indexOf('function.template.js') === -1) {
      let functionTemplateContent = 'var lambdaCfn = require(\'@mapbox/lambda-cfn\');\n\n'
            + 'module.exports = lambdaCfn.build({\n'
            + '  name: \'' + name + '\'\n'
            + '});';
      q.defer(fs.writeFile, 'function.template.js', functionTemplateContent);
    }

    q.awaitAll(function(err) {
      if(err) return callback(err);
      return callback(null, 'Created function skeleton files');
    });
  });
}

function init(name, callback) {
  checkPackageJson(function(err) {
    if (err) callback(err);
    createFunctionFiles(name, function(err, res) {
      return callback(err, res);
    });
  });
}

module.exports = init;
module.exports.checkPackageJson = checkPackageJson;
module.exports.createFunctionFiles = createFunctionFiles;
