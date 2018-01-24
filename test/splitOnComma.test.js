const tape = require('tape');
const lambdaCfn = require('../index.js');

tape('splitOnComma unit tests', (t) => {
  let splitOnComma = lambdaCfn.splitOnComma;
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
