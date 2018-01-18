function splitOnComma(str) {
  if (str) {
    return str.split(/\s*,\s*/);
  }
  // splitting unset parameter shouldn't return a non-falsey value
  return '';
}
module.exports = splitOnComma;
