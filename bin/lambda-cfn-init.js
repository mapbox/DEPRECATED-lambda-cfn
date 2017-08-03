#!/usr/bin/env node
var argv = require('minimist')(process.argv);
var lambdaCfnInit = require('../lib/init.js');

if (!argv._[2]) {
  console.log('Please provide a name for the function');
  process.exit(1);
}

lambdaCfnInit.init(argv._[2]);