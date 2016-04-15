#!/usr/bin/env node
var root = process.env.LAMBDA_TASK_ROOT ?
  process.env.LAMBDA_TASK_ROOT :
  require('app-root-path').path;

var fs = require('fs');
var path = require('path');

var templateFile;
var files = fs.readdirSync(path.join(root, 'cloudformation'));
for (var i = 0; i < files.length; i++) {
  var file = files[i];
  if (path.extname(file) == '.js' && file.indexOf('.template.') > -1) {
    templateFile = path.join(root, 'cloudformation', file);
    break;
  }
}
var template = require(templateFile);
console.log(JSON.stringify(template));
