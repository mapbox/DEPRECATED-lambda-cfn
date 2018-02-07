const path = require('path');
const fs = require('fs');

const meow = require('meow');
const git = require('git-rev-sync');
const cfnConfig = require('@mapbox/cfn-config');

const lambdaCfn = require('../index.js');

module.exports.main = main;
module.exports.parse = parse;

function parse(args, env) {
  const cli = meow({
    argv: args,
    help: `
      USAGE: lambda-cfn <command> <environment> [templatePath] [options]

      command:
        - init                  initialize a new function
        - create                create a new stack
        - update                update an existing stack
        - delete                delete an existing stack
        - info                  fetch information about an existing stack
        - save                  save an existing stack's configuration

      environment:
        Any string. A stack's name is constructed as name-environment

      templatePath:
        The relative path to the CloudFormation template in JSON format, required
        for create and update commands.

      options:
        -n, --name              the stack's base name (default: current dir name)
        -r, --region            the stack's region (default: us-east-1)
        -c, --config-bucket     an S3 bucket for storing stack configurations.
                                Required for the create, update, and save commands.
                                Looks for CFN_CONFIG_BUCKET environment variable
                                (default: cfn-configs-$AWS_ACCOUNT_ID-region)
        -t, --template-bucket   an S3 bucket for storing templates
                                (default: cfn-config-templates-$AWS_ACCOUNT_ID-region)
        -k, --kms               a KMS key ID for parameter encryption or
                                configuration encryption at rest on S3. If not
                                provided, no encryption will be performed. If
                                provided as a flag without a value, the default
                                key id alias/cloudformation will be used.
        -f, --force             perform a create/update/delete command without any
                                prompting, accepting all defaults
        -e, --extended          display resource details with the info command
        -d, --decrypt           decrypt secure parameters with the info command
        -p, --parameters        JSON string of parameters to override on create/update
        -a, --all               Toboggan deploy of all functions found in subdirectories
    `
  }, {
    alias: {
      c: 'config-bucket',
      t: 'template-bucket',
      n: 'name',
      r: 'region',
      k: 'kms',
      f: 'force',
      e: 'extended',
      d: 'decrypt',
      p: 'parameters',
      a: 'all'
    },
    string: ['config-bucket', 'template-bucket', 'name', 'region', 'parameters'],
    boolean: ['force', 'extended', 'decrypt', 'all'],
    default: {
      region: (env.AWS_REGION ? env.AWS_REGION : 'us-east-1'),
      force: false,
      kms: false,
      extended: false,
      decrypt: false,
      parameters: undefined,
      all: false
    }
  });

  // check the caller location and set sane template default location
  if (!cli.flags.all) { // no tobogganing
    if (!cli.input[2] && cli.input[0] !== 'init') {
      let files = fs.readdirSync(process.cwd());
      if (files.indexOf('function.template.js') === -1) {
        throw new Error('function.template.js file not found in ' + process.cwd());
      }
      cli.input[2] = './function.template.js';
      // generate default function name of repoDir-functionDir
      // stack name then is later set to repoDir-functionDir-environment
      if (!cli.flags.name) {
        cli.flags.name = cli.flags.n = (process.cwd().split(path.sep).slice(-2)).join('-');
      }
    }
  }

  if (/init/.test(cli.input[0])) {
    if (!cli.input[1])
      throw new Error('Please provide a function name to initialize');
    if (cli.flags.all)
      throw new Error('init tobogganing not currently supported');
  }

  // Make sure that we can set a template bucket for create and update commands
  if (/create|update/.test(cli.input[0])) {
    if (!cli.flags.templateBucket && !env.AWS_ACCOUNT_ID) {
      throw new Error('Provide $AWS_ACCOUNT_ID as an environment variable to use the default template bucket, or set --template-bucket');
    }
    if (!cli.flags.templateBucket) cli.flags.templateBucket =
      ['cfn-config-templates', env.AWS_ACCOUNT_ID, cli.flags.region].join('-');
  }
  // Make sure that we can set a configs bucket for create and update commands
  if (/create|update|save/.test(cli.input[0])) {
    if (!cli.flags.configBucket && env.CFN_CONFIG_BUCKET) {
      cli.flags.configBucket = env.CFN_CONFIG_BUCKET;
    } else if (!cli.flags.configBucket && !env.AWS_ACCOUNT_ID) {
      throw new Error('Provide $AWS_ACCOUNT_ID as an environment variable to use the default config bucket, or set --config-bucket');
    } else if (!cli.flags.configBucket) {
      cli.flags.configBucket = ['cfn-configs', env.AWS_ACCOUNT_ID, cli.flags.region].join('-');
    }
  }

  let parameters = {};

  if (cli.flags.parameters) {
    try {
      parameters =
      cli.flags.p =
      cli.flags.parameters = JSON.parse(cli.flags.parameters);
    } catch(err) {
      throw new Error('Invalid JSON for --parameters: ' + err.message);
    }
  }

  // override with latest gitsha
  if (cli.input[0] !== 'init') {
    parameters.GitSha = git.long(process.cwd());
  }

  return {
    command: cli.input[0],
    environment: cli.input[1],
    templatePath: cli.input[2] ? path.resolve(cli.input[2]) : undefined,
    overrides: { force: cli.flags.force, kms: cli.flags.kms, parameters: parameters },
    options: cli.flags,
    help: cli.help
  };
}

function main(parsed, callback) {

  if (parsed.command === 'init') {
    lambdaCfn.init(parsed.environment, function(err, data) {
      if (err) return callback({message: err});
      return callback(null, data);
    });
  } else {

    // Setup commands, make sure that CLI request uses a valid command
    let available = cfnConfig.commands(parsed.options);

    if (!available[parsed.command]) {
      return callback({ message: 'Error: invalid command\n\n' + parsed.help });
    }

    // Check for valid environment
    if (!parsed.environment) {
      return callback({ message: 'Error: missing environment\n\n' + parsed.help });
    }

    // Check for template path on create and update
    if (/create|update/.test(parsed.command) && !parsed.templatePath) {
      return callback({ message: 'Error: missing templatePath\n\n' + parsed.help });
    }

    // Set the arguments for the command that will run
    let args = [parsed.environment];

    if (parsed.command === 'info') {
      args.push(parsed.options.extended);
      args.push(parsed.options.decrypt);
    }

    if (/create|update/.test(parsed.command)) {
      args.push(parsed.templatePath);
    }

    if (parsed.overrides.kms && parsed.command === 'save') {
      args.push(parsed.overrides.kms);
    }

    if (/create|update|delete/.test(parsed.command)) {
      args.push(parsed.overrides);
    }

    args.push(callback);

    // Run the command
    available[parsed.command].apply(null, args);
  }
}
