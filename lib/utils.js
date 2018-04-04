function capitalizeFirst(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function splitOnComma(str) {
  if (str) {
    return str.split(',').map(item => item.trim());
  }
  // splitting unset parameter shouldn't return a non-falsey value
  return '';
}

module.exports.capitalizeFirst = capitalizeFirst;
module.exports.splitOnComma = splitOnComma;
