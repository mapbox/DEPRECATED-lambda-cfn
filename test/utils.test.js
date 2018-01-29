const tape = require('tape');
const lambdaCfn = require('../index.js');
const capitalizeFirst = require('../lib/utils').capitalizeFirst;

tape('splitOnComma unit tests', (t) => {
  let splitOnComma = lambdaCfn.splitOnComma;
  t.deepEqual(
    splitOnComma('foo, bar'),
    ['foo', 'bar'],
    'split string with comma'
  );

  t.deepEqual(
    splitOnComma('foo,    bar'),
    ['foo', 'bar'],
    'Split string with multiple spaces'
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

tape('Capitalize First unit tests', (t) => {
  let input = 'random idea';
  let expected = 'Random idea';
  t.equal(expected, capitalizeFirst(input));

  input = 'RAMDOM';
  expected = 'RAMDOM';

  t.equal(expected, capitalizeFirst(input));

  t.end();
});
