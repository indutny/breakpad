import { createWriteStream } from 'node:fs';
import { stat, rename, readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { symbolicateFrames } from '../lib/breakpad.js';

const ITERATIONS = 10;
const SYMBOL_URL =
  'https://symbols.electronjs.org/Electron%20Framework/' +
  '4C4C44C455553144A1311334F13F98720/Electron%20Framework.sym';
const LOCAL_PATH = new URL('./electron.sym', import.meta.url);
const MBS = (1024 * 1024) / 1000; // mbs/sec

let SYMBOLS;

// Check if already downloaded
try {
  SYMBOLS = await readFile(LOCAL_PATH);
  console.log('Cached symbols available');
} catch {
  console.log('Downloading symbols...');

  // If not - download!
  const res = await fetch(SYMBOL_URL);
  if (!res.ok) {
    throw new Error(`Download failed, ${res.status}`);
  }

  const TMP_PATH = new URL('./electron.sym.tmp', import.meta.url);

  await pipeline(res.body, createWriteStream(TMP_PATH));

  await rename(TMP_PATH, LOCAL_PATH);

  SYMBOLS = await readFile(LOCAL_PATH);
}

console.log('Running');

async function one() {
  const start = performance.now();

  const stream = Readable.from(SYMBOLS);

  const result = await symbolicateFrames(
    stream,
    [
      0x0000000006e21774, 0x00000000035253ac, 0x0000000003521eec,
      0x0000000003521ff8, 0x000000000352204c, 0x0000000003521b60,
      0x0000000003521ba8, 0x0000000000296850, 0x00000000002a4a9c,
      0x00000000002a55d8, 0x00000000002a5440, 0x00000000015952e8,
      0x00000000014973cc, 0x0000000006ef8f7c, 0x0000000006ef93c4,
      0x0000000000411440, 0x0000000000339f50, 0x00000000003221d0,
      0x00000000003222ac, 0x000000000035e024, 0x0000000003336d34,
      0x000000000035e294, 0x000000000388b7ec, 0x0000000003890210,
      0x000000000388d3d8, 0x0000000003b6a280, 0x000000000357911c,
      0x00000000035935fc, 0x0000000003593c0c, 0x00000000035ddb34,
      0x00000000001e95fc, 0x00000000035dccfc, 0x0000000003594274,
      0x000000000355f5a4, 0x000000000272f4d4, 0x0000000002730f54,
      0x000000000272ce08, 0x00000000005aa640, 0x00000000005ab6a0,
      0x00000000005ab518, 0x00000000005a9e58, 0x00000000005aa01c,
      0x0000000000284518,
    ],
  );

  return performance.now() - start;
}

let mean = 0;
let stddev = 0;
for (let i = 1; i <= ITERATIONS; i += 1) {
  const duration = await one();
  const value = SYMBOLS.length / duration;

  console.log(`${i}/${ITERATIONS}: ${(value / MBS).toFixed(1)}mb/s`);

  mean += value;
  stddev += value ** 2;
}

mean /= ITERATIONS;
stddev /= ITERATIONS;
stddev -= mean ** 2;
stddev = Math.sqrt(stddev);

const stddevPerc = (stddev / mean) * 100;

console.log('');
console.log(`Mean Throughput: ${(mean / MBS).toFixed(1)}mb/s`);
console.log(`StdDev: ${stddevPerc.toFixed(1)}%`);
