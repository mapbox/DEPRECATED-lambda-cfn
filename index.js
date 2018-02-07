module.exports = {
  build: require('./lib/cfn'),
  init: require('./lib/init'),
  splitOnComma: require('./lib/utils').splitOnComma,
  capitalizeFirst: require('./lib/utils').capitalizeFirst,
  message: require('./lib/message')
};
