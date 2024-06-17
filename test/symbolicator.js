import { Readable } from 'node:stream';
import test from 'ava';

import { symbolicateFrames } from '../lib/breakpad.js';

test('it symbolicates', async (t) => {
  const result = await symbolicateFrames(
    Readable.from([
      'MODULE mac arm64 4C4C44C455553144A1311334F13F98720 Electron Framework\n',
      'FILE 0 abc\n',
      'FUNC 0 20 10 my_func()\n',
      '0 10 0 0\n',
      '10 10 1 0\n',
      'FUNC 20 10 5 other_func()\n', // no line info
      'PUBLIC 30 123 public_fn()\n', // fallback
    ]),
    [0x0, 0x15, 0x25, 0x35],
  );

  t.deepEqual(result, [
    { addr: 0, file: 'abc', line: 0, name: 'my_func()', size: 0x20 },
    { addr: 0, file: 'abc', line: 1, name: 'my_func()', size: 0x20 },
    { addr: 0x20, file: null, line: null, name: 'other_func()', size: 0x10 },
    { addr: 0x30, file: null, line: null, name: 'public_fn()', size: null },
  ]);
});
