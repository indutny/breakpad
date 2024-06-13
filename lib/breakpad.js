import {
  Parser,
  TYPE_LINE,
  TYPE_FUNC,
  TYPE_FILE,
  TYPE_PUBLIC,
} from './parser.js';

// eslint-disable-next-line import/prefer-default-export
export async function symbolicateFrames(stream, frames) {
  const matches = frames.map(() => null);
  const publicMatches = frames.map(() => null);
  const lineWatchers = [];
  const files = new Map();

  const p = new Parser((row) => {
    const type = row[0];

    if (type === TYPE_LINE) {
      const addr = row[1];
      const size = row[2];
      const line = row[3];
      const fileIndex = row[4];
      let file;

      for (let i = 0; i < lineWatchers.length; i += 1) {
        const watcher = lineWatchers[i];
        if (watcher.offset >= addr && watcher.offset - addr < size) {
          watcher.line = line;
          file ||= files.get(fileIndex);
          watcher.file = file;
        }
      }
    } else if (type === TYPE_FILE) {
      const index = row[1];
      const name = row[2];
      files.set(index, name);
    } else if (type === TYPE_FUNC) {
      lineWatchers.length = 0;

      const addr = row[1];
      const size = row[2];
      const name = row[4];

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
    } else if (type === TYPE_PUBLIC) {
      const addr = row[1];
      const name = row[3];

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
    }
  });

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
