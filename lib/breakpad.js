import { Parser } from '@indutny/breakpad-parser-wasm';

const DECODER = new TextDecoder();
const ENCODER = new TextEncoder();

const CHUNK_SIZE = 1024 * 1024;

export async function symbolicateFrames(stream, frames) {
  const matches = frames.map(() => null);
  const publicMatches = frames.map(() => null);
  const lineWatchers = [];
  const files = new Map();

  let strBuffer = '';
  const onStrValue = (value) => {
    strBuffer += DECODER.decode(value);
  };

  const onLine = (addr, size, line, fileIndex) => {
    let file;

    for (let i = 0; i < lineWatchers.length; i += 1) {
      const watcher = lineWatchers[i];
      if (watcher.offset >= addr && watcher.offset - addr < size) {
        watcher.line = line;
        file ||= files.get(fileIndex);
        watcher.file = file;
      }
    }
  };

  const onFile = (index) => {
    files.set(index, strBuffer);
    strBuffer = '';
  };

  const onFunc = (addr, size, _params) => {
    const name = strBuffer;
    strBuffer = '';

    lineWatchers.length = 0;

    for (let i = 0; i < frames.length; i += 1) {
      const offset = frames[i];
      if (offset < addr || offset - addr >= size) {
        continue;
      }

      const entry = {
        offset,

        name,
        addr,
        size,
        line: null,
        file: null,
      };

      matches[i] = entry;
      lineWatchers.push(entry);
    }
  };

  const onPublic = (addr, _params) => {
    const name = strBuffer;
    strBuffer = '';

    for (let i = 0; i < frames.length; i += 1) {
      const offset = frames[i];

      if (offset < addr) {
        continue;
      }

      const existing = publicMatches[i];
      if (existing && existing.addr > addr) {
        continue;
      }

      const entry = {
        offset,
        name,
        addr,
      };

      publicMatches[i] = entry;
    }
  };

  const p = new Parser({ onLine, onFile, onFunc, onPublic, onStrValue });

  for await (const rawChunk of stream) {
    let chunk;
    if (rawChunk instanceof Uint8Array) {
      chunk = rawChunk;
    } else if (typeof rawChunk === 'string') {
      chunk = ENCODER.encode(rawChunk);
    }
    for (let i = 0; i < chunk.length; i += CHUNK_SIZE) {
      p.parse(chunk.subarray(i, i + CHUNK_SIZE));
    }
  }
  p.finish();
  p.free();

  return matches.map((match, i) => {
    if (match === null) {
      const publicMatch = publicMatches[i];
      if (publicMatch) {
        return {
          name: publicMatch.name.trim(),
          addr: publicMatch.addr,
          size: null,
          file: null,
          line: null,
        };
      }
      return null;
    }

    const { name, addr, size, file, line } = match;

    return {
      name: name.trim(),
      addr,
      size,
      file: file?.length ? file.trim() : null,
      line,
    };
  });
}
