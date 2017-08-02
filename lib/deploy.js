module.exports.deploy = deploy;

var cfnConfig = require('@mapbox/cfn-config');

function deploy(command, stackName, environment, template, region, cfnConfigBucket, templateBucket) {

  var options = {
    name: stackName,
    region: region,
    configBucket: cfnConfigBucket,
    templateBucket: templateBucket
  }

  var commands = cfnConfig.commands(options);

  switch (command) {
    case 'create':
      commands.create(environment, template, function (err) {
        if (err) console.error(`Create failed: ${err.message}`);
        else console.log('Create succeeded');
      });
      break;
    case 'update':
      commands.update(environment, template, function (err) {
        if (err) console.error(`Update failed: ${err.message}`);
        else console.log('Update succeeded');
      });
      break;
    case 'save':
      commands.save(environment, function (err) {
        if (err) console.error(`Failed to save configuration: ${err.message}`);
        else console.log('Saved configuration');
      });
      break;
    case 'info':
      commands.info(environment, function(err, info) {
        if (err) console.error(`Failed to read stack info: ${err.message}`);
        else console.log(JSON.stringify(info, null, 2));
      });
      break;
    case 'delete':
      commands.delete(environment, function(err) {
        if (err) console.error(`Delete failed: ${err.message}`);
        else console.log('Delete succeeded');
      });
      break;
  }

}