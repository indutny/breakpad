# @indutny/breakpad

[![npm](https://img.shields.io/npm/v/@indutny/breakpad)](https://www.npmjs.com/package/@indutny/breakpad)

Fast symbolication of crash reports using
[breakpad symbol files](https://chromium.googlesource.com/breakpad/breakpad/+/master/docs/symbol_files.md).

## Installation

```sh
npm install @indutny/breakpad
```

## Usage

```js
import { createReadStream } from 'node:fs';

import { symbolicateFrames } from '@indutny/breakpad';

const symbolsFile = createReadStream('/tmp/1.sym');

const result = await symbolicateFrames(
  symbolsFile,
  [
    0x0000000006e21774, 0x00000000035253ac, 0x0000000003521eec,
    0x0000000003521ff8,
  ],
);

console.log(result);
```

## Benchmarks

```sh
$ npm run benchmark
...
Mean Throughput: 414.1mb/s
StdDev: 0.9%
```

## LICENSE

This software is licensed under the MIT License.
