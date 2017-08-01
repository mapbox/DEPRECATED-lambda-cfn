module.exports = splitOnComma;
function splitOnComma(str) {
  if (str) {
    return str.split(/\s*,\s*/);
  } else {
    // splitting unset parameter shouldn't return a non-falsey value
    return '';
  }
};
