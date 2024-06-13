# @indutny/breakpad

[![npm](https://img.shields.io/npm/v/@indutny/breakpad)](https://www.npmjs.com/package/@indutny/breakpad)


## Installation

```sh
npm install @indutny/breakpad
```

## Usage

```js
import { createReadStream } from 'node:fs';

import { symbolicateFrames } from '@indutny/breakpad';

const symbolsFile = createReadStream('/tmp/1.sym');

const result = await symbolicateFrames(symbolsFile, [
    0x0000000006e21774,
    0x00000000035253ac,
    0x0000000003521eec,
    0x0000000003521ff8,
]);

console.log(result);
```

## LICENSE

This software is licensed under the MIT License.
