import { Readable } from 'node:stream';
import test from 'ava';

import Parser from '../lib/parser.js';

async function parse(chunks) {
  const result = [];

  function translate(args) {
    return args.map((arg) => {
      if (typeof arg === 'number') {
        return arg;
      }

      if (Array.isArray(arg)) {
        return Buffer.concat(arg).toString();
      }

      throw new Error(`Unexpected arg: ${arg}`);
    });
  }

  const p = new Parser({
    onLine: (...args) => result.push(['line', ...translate(args)]),
    onFile: (...args) => result.push(['file', ...translate(args)]),
    onFunc: (...args) => result.push(['func', ...translate(args)]),
    onPublic: (...args) => result.push(['public', ...translate(args)]),
  });

  await p.parse(Readable.from(chunks));

  return result;
}

test('it emits the trailing row', async (t) => {
  const result = await parse([
    'MODULE mac arm64 4C4C44C455553144A1311334F13F98720 Electron Framework\n',
    'FILE 0 abc\n',
  ]);

  t.deepEqual(result, [['file', 0, 'abc']]);
});

test('it supports all row types', async (t) => {
  const result = await parse([
    'MODULE mac arm64 4C4C44C455553144A1311334F13F98720 Electron Framework\n',
    'FILE 0 a\n',
    'F',
    'ILE 1 bc\n',
    'FILE 2 d',
    'ef\n',
    'F',
    'UNC 22226c 12c 0 bool my_func()\n',
    'FUNC m abc def 123 bool my_',
    'func_2()\n',
    '2222',
    '6c 20 1874 75507\n',
    '22228c 4 12',
    '62 75507\n',
    '222290 4 1087 75',
    '507\n',
    'STACK blah blah\n', // ignored
    'PUBLIC 2160 0 Public1\n',
    'PUBLIC m 3162 13 Public2\n',
  ]);

  t.deepEqual(result, [
    ['file', 0, 'a'],
    ['file', 1, 'bc'],
    ['file', 2, 'def'],
    ['func', 0x22226c, 0x12c, 0x0, 'bool my_func()'],
    ['func', 0xabc, 0xdef, 0x123, 'bool my_func_2()'],
    ['line', 0x22226c, 0x20, 1874, 75507],
    ['line', 0x22228c, 0x4, 1262, 75507],
    ['line', 0x222290, 0x4, 1087, 75507],
    ['public', 0x2160, 0, 'Public1'],
    ['public', 0x3162, 0x13, 'Public2'],
  ]);
});

test('it keeps windows line ends', async (t) => {
  const result = await parse([
    'MODULE mac arm64 4C4C44C455553144A1311334F13F98720 Electron Framework\r\n',
    'FILE 0 a\r\n',
    'FUNC 22226c 12c 0 bool my_func()\r\n',
    '22226c 20 1874 75507\r\n',
  ]);

  t.deepEqual(result, [
    ['file', 0, 'a\r'],
    ['func', 0x22226c, 0x12c, 0x0, 'bool my_func()\r'],
    ['line', 0x22226c, 0x20, 1874, 75507],
  ]);
});
