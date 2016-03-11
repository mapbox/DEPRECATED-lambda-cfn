var test = require('tape');

var utils = require('../lib/utils');

var splitOnComma = utils.splitOnComma;

test('splitOnComma unit tests', function(t) {

  t.deepEqual(
    splitOnComma('foo, bar'),
    ['foo', 'bar'],
    'split string with comma'
  );

  t.deepEqual(
    splitOnComma('foo'),
    ['foo'],
    'split string with no comma'
  );

  t.deepEqual(
    splitOnComma('foo,bar'),
    ['foo', 'bar'],
    'split string with comma and no space'
  );

  t.end();
});