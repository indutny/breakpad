import Parser from './parser.js';

// eslint-disable-next-line import/prefer-default-export
export async function symbolicateFrames(stream, frames) {
  const matches = frames.map(() => null);
  const publicMatches = frames.map(() => null);
  const lineWatchers = [];
  const files = new Map();

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

  const onFile = (index, name) => files.set(index, name);

  const onFunc = (addr, size, _params, name) => {
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

  const onPublic = (addr, _params, name) => {
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

  const p = new Parser({ onLine, onFile, onFunc, onPublic });

  await p.parse(stream);

  return matches.map((match, i) => {
    if (match === null) {
      const publicMatch = publicMatches[i];
      if (publicMatch) {
        return {
          name: Buffer.concat(publicMatch.name).toString().trim(),
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
      name: Buffer.concat(name).toString().trim(),
      addr,
      size,
      file: file ? Buffer.concat(file).toString().trim() : null,
      line,
    };
  });
}
