// Parser for:
// https://chromium.googlesource.com/breakpad/breakpad/+/master/docs/symbol_files.md

const STATE_START = 0;

const STATE_LINE_HEX_1 = 1; // hex
const STATE_LINE_HEX_2 = 2; // hex
const STATE_LINE_DEC_3 = 3; // dec
const STATE_LINE_DEC_4 = 4; // dec
const STATE_LINE_END = 5;

const STATE_SKIP = 6; // "S.*"

const STATE_FUNC_OR_FILE = 7; // "FU"|"FI"

const STATE_FUNC_1 = 8; // "FUNC (m )?"
const STATE_FUNC_HEX_2 = 9; // hex
const STATE_FUNC_HEX_3 = 10; // hex
const STATE_FUNC_HEX_4 = 11; // hex
const STATE_FUNC_NAME_5 = 12; // name
const STATE_FUNC_END = 13; // end

const STATE_FILE_1 = 14; // "FILE"
const STATE_FILE_DEC_2 = 15; // dec
const STATE_FILE_NAME_3 = 16; // name
const STATE_FILE_END = 17; // end

const STATE_PUBLIC_1 = 18; // "PUBLIC (m )?"
const STATE_PUBLIC_HEX_2 = 19; // hex
const STATE_PUBLIC_HEX_3 = 20; // hex
const STATE_PUBLIC_NAME_4 = 21; // name
const STATE_PUBLIC_END = 22; // end

const ENCODER = new TextEncoder();

export default class Parser {
  state = STATE_START;

  intValue = 0;

  strParts = [];

  row = new Uint32Array(4);

  rowPos = 0;

  onLine;

  onFunc;

  onFile;

  onPublic;

  constructor({ onLine, onFunc, onFile, onPublic }) {
    this.onLine = onLine;
    this.onFunc = onFunc;
    this.onFile = onFile;
    this.onPublic = onPublic;
  }

  async parse(stream) {
    for await (const chunk of stream) {
      this.parseChunk(chunk);
    }

    switch (this.state) {
      case STATE_LINE_END:
        this.onLineEnd();
        break;
      case STATE_FUNC_END:
        this.onFuncEnd();
        break;
      case STATE_FILE_END:
        this.onFileEnd();
        break;
      case STATE_PUBLIC_END:
        this.onPublicEnd();
        break;
      default:
        break;
    }
  }

  parseChunk(rawChunk) {
    let chunk;
    if (rawChunk instanceof Uint8Array) {
      chunk = rawChunk;
    } else {
      chunk = ENCODER.encode(rawChunk);
    }

    let offset = 0;
    while (offset < chunk.length) {
      switch (this.state) {
        case STATE_START:
          offset = this.parseStart(chunk, offset);
          break;
        case STATE_FUNC_OR_FILE:
          offset = this.parseFuncOrFile(chunk, offset);
          break;
        case STATE_LINE_HEX_1:
        case STATE_LINE_HEX_2:
        case STATE_FUNC_HEX_2:
        case STATE_FUNC_HEX_3:
        case STATE_FUNC_HEX_4:
        case STATE_PUBLIC_HEX_2:
        case STATE_PUBLIC_HEX_3:
          offset = this.parseHex(chunk, offset);
          break;
        case STATE_LINE_DEC_3:
        case STATE_LINE_DEC_4:
        case STATE_FILE_DEC_2:
          offset = this.parseDec(chunk, offset);
          break;
        case STATE_FUNC_NAME_5:
        case STATE_FILE_NAME_3:
        case STATE_PUBLIC_NAME_4:
          offset = this.parseName(chunk, offset);
          break;
        case STATE_FUNC_1:
        case STATE_FILE_1:
        case STATE_PUBLIC_1:
          offset = this.skipUntilDigit(chunk, offset);
          break;
        case STATE_LINE_END:
          this.onLineEnd();
          break;
        case STATE_FUNC_END:
          this.onFuncEnd();
          break;
        case STATE_FILE_END:
          this.onFileEnd();
          break;
        case STATE_PUBLIC_END:
          this.onPublicEnd();
          break;
        case STATE_SKIP:
          offset = this.skipPastNewline(chunk, offset);
          break;
        default:
          // Unreachable
          break;
      }
    }
  }

  parseStart(chunk, offset) {
    const ch = chunk[offset];
    if (ch === 0x46) {
      // 'F' -> 'FUNC' | 'FILE'
      this.state = STATE_FUNC_OR_FILE;
    } else if (ch === 0x50) {
      // 'P'
      this.state = STATE_PUBLIC_1;
    } else if (
      // 0-9
      (0x30 <= ch && ch <= 0x39) ||
      // a-f
      (0x61 <= ch && ch <= 0x66)
    ) {
      this.state = STATE_LINE_HEX_1;

      // First character is significant
      return offset;
    } else {
      // Likely STACK
      this.state = STATE_SKIP;
    }

    return offset + 1;
  }

  parseFuncOrFile(chunk, offset) {
    const ch = chunk[offset];
    if (ch === 0x55) {
      // 'U'
      this.state = STATE_FUNC_1;
    } else if (ch === 0x49) {
      // 'I'
      this.state = STATE_FILE_1;
    } else {
      this.state = STATE_SKIP;
    }
    return offset + 1;
  }

  parseHex(chunk, offset) {
    let intValue = this.intValue;
    for (let i = offset; i < chunk.length; i += 1) {
      const ch = chunk[i];
      if (0x30 <= ch && ch <= 0x39) {
        // 0-9
        // eslint-disable-next-line no-bitwise
        intValue = (intValue << 4) | (ch - 0x30);
      } else if (0x61 <= ch && ch <= 0x66) {
        // a-f
        // eslint-disable-next-line no-bitwise
        intValue = (intValue << 4) | (ch - 0x61 + 0x0a);
      } else {
        // eslint-disable-next-line no-plusplus
        this.row[this.rowPos++] = intValue;
        this.intValue = 0;
        this.state += 1;
        return i + 1;
      }
    }
    this.intValue = intValue;
    return chunk.length;
  }

  parseDec(chunk, offset) {
    let intValue = this.intValue;
    for (let i = offset; i < chunk.length; i += 1) {
      const ch = chunk[i];
      if (0x30 <= ch && ch <= 0x39) {
        // 0-9
        intValue = intValue * 10 + (ch - 0x30);
      } else {
        // eslint-disable-next-line no-plusplus
        this.row[this.rowPos++] = intValue;
        this.intValue = 0;
        this.state += 1;
        return i + 1;
      }
    }
    this.intValue = intValue;
    return chunk.length;
  }

  parseName(chunk, offset) {
    const newOffset = chunk.indexOf(0x0a, offset); // '\n'
    if (newOffset === -1) {
      this.strParts.push(chunk.subarray(offset));
      return chunk.length;
    }

    this.strParts.push(chunk.slice(offset, newOffset));

    this.state += 1;
    return newOffset + 1;
  }

  skipPastNewline(chunk, offset) {
    const newOffset = chunk.indexOf(0x0a, offset); // '\n'
    if (newOffset === -1) {
      return chunk.length;
    }

    this.state = STATE_START;
    return newOffset + 1;
  }

  skipUntilDigit(chunk, offset) {
    for (let i = offset; i < chunk.length; i += 1) {
      const ch = chunk[i];
      if (
        (0x30 <= ch && ch <= 0x39) || // 0-9
        (0x61 <= ch && ch <= 0x66) // a-f
      ) {
        this.state += 1;
        return i;
      }
    }
    return chunk.length;
  }

  onLineEnd() {
    this.onLine(this.row[0], this.row[1], this.row[2], this.row[3]);
    this.onEnd();
  }

  onFuncEnd() {
    this.onFunc(this.row[0], this.row[1], this.row[2], this.strParts);
    this.strParts = [];
    this.onEnd();
  }

  onFileEnd() {
    this.onFile(this.row[0], this.strParts);
    this.strParts = [];
    this.onEnd();
  }

  onPublicEnd() {
    this.onPublic(this.row[0], this.row[1], this.strParts);
    this.strParts = [];
    this.onEnd();
  }

  onEnd() {
    this.rowPos = 0;
    this.state = STATE_START;
  }
}
