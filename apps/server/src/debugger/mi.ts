/**
 * Parser for GDB/MI output records (GDB manual, "GDB/MI Output Syntax").
 *
 * Tuples become objects. Lists of values become arrays; lists of results
 * (e.g. stack=[frame={…},frame={…}]) become arrays of their values.
 */

export type MiValue = string | MiTuple | MiValue[];
export interface MiTuple {
  [key: string]: MiValue;
}

export type MiRecordType = 'result' | 'exec' | 'status' | 'notify' | 'console' | 'target' | 'log' | 'prompt' | 'unknown';

export interface MiRecord {
  type: MiRecordType;
  token?: number;
  /** done, running, error, exit, stopped, breakpoint-modified, … */
  klass?: string;
  results: MiTuple;
  /** Text payload of stream records. */
  text?: string;
}

class Cursor {
  pos = 0;
  constructor(readonly src: string) {}
  peek(): string {
    return this.src[this.pos] ?? '';
  }
  next(): string {
    return this.src[this.pos++] ?? '';
  }
  eof(): boolean {
    return this.pos >= this.src.length;
  }
}

/** Decodes a C string as written by GDB (octal escapes carry raw UTF-8 bytes). */
function parseCString(c: Cursor): string {
  if (c.next() !== '"') {
    throw new Error(`Expected '"' at ${c.pos - 1} in ${c.src}`);
  }
  const bytes: number[] = [];
  const pushText = (s: string): void => {
    for (const b of Buffer.from(s, 'utf8')) {
      bytes.push(b);
    }
  };
  while (!c.eof()) {
    const ch = c.next();
    if (ch === '"') {
      return Buffer.from(bytes).toString('utf8');
    }
    if (ch !== '\\') {
      pushText(ch);
      continue;
    }
    const esc = c.next();
    switch (esc) {
      case 'n': bytes.push(10); break;
      case 't': bytes.push(9); break;
      case 'r': bytes.push(13); break;
      case 'f': bytes.push(12); break;
      case 'v': bytes.push(11); break;
      case 'a': bytes.push(7); break;
      case 'b': bytes.push(8); break;
      case 'e': bytes.push(27); break;
      default:
        if (/[0-7]/.test(esc)) {
          let octal = esc;
          while (octal.length < 3 && /[0-7]/.test(c.peek())) {
            octal += c.next();
          }
          bytes.push(Number.parseInt(octal, 8) & 0xff);
        } else {
          pushText(esc);
        }
    }
  }
  throw new Error(`Unterminated string in ${c.src}`);
}

function parseVariable(c: Cursor): string {
  const start = c.pos;
  while (!c.eof() && c.peek() !== '=') {
    c.next();
  }
  return c.src.slice(start, c.pos);
}

function parseValue(c: Cursor): MiValue {
  const ch = c.peek();
  if (ch === '"') {
    return parseCString(c);
  }
  if (ch === '{') {
    c.next();
    const tuple: MiTuple = {};
    if (c.peek() === '}') {
      c.next();
      return tuple;
    }
    for (;;) {
      const [key, value] = parseResult(c);
      tuple[key] = value;
      const sep = c.next();
      if (sep === '}') {
        return tuple;
      }
      if (sep !== ',') {
        throw new Error(`Expected ',' or '}' in tuple: ${c.src}`);
      }
    }
  }
  if (ch === '[') {
    c.next();
    const list: MiValue[] = [];
    if (c.peek() === ']') {
      c.next();
      return list;
    }
    for (;;) {
      const p = c.peek();
      if (p === '"' || p === '{' || p === '[') {
        list.push(parseValue(c));
      } else {
        list.push(parseResult(c)[1]);
      }
      const sep = c.next();
      if (sep === ']') {
        return list;
      }
      if (sep !== ',') {
        throw new Error(`Expected ',' or ']' in list: ${c.src}`);
      }
    }
  }
  throw new Error(`Unexpected '${ch}' at ${c.pos} in ${c.src}`);
}

function parseResult(c: Cursor): [string, MiValue] {
  const name = parseVariable(c);
  if (c.next() !== '=') {
    throw new Error(`Expected '=' after ${name}`);
  }
  return [name, parseValue(c)];
}

function parseResults(c: Cursor): MiTuple {
  const results: MiTuple = {};
  while (c.peek() === ',') {
    c.next();
    const [key, value] = parseResult(c);
    results[key] = value;
  }
  return results;
}

const PREFIX: Record<string, MiRecordType> = {
  '^': 'result',
  '*': 'exec',
  '+': 'status',
  '=': 'notify',
  '~': 'console',
  '@': 'target',
  '&': 'log',
};

export function parseMiLine(line: string): MiRecord {
  const trimmed = line.replace(/\r$/, '');
  if (trimmed.startsWith('(gdb)')) {
    return { type: 'prompt', results: {} };
  }
  const c = new Cursor(trimmed);
  let tokenText = '';
  while (/[0-9]/.test(c.peek())) {
    tokenText += c.next();
  }
  const type = PREFIX[c.peek()];
  if (!type) {
    return { type: 'unknown', results: {}, text: trimmed };
  }
  c.next();
  const token = tokenText ? Number(tokenText) : undefined;
  if (type === 'console' || type === 'target' || type === 'log') {
    return { type, results: {}, text: parseCString(c), ...(token !== undefined ? { token } : {}) };
  }
  const start = c.pos;
  while (!c.eof() && c.peek() !== ',') {
    c.next();
  }
  const klass = trimmed.slice(start, c.pos);
  const results = parseResults(c);
  return { type, klass, results, ...(token !== undefined ? { token } : {}) };
}

/** Quotes a string as an MI c-string argument; rejects control characters. */
export function miQuote(text: string): string {
  if ([...text].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) {
    throw new Error('Control characters are not allowed in debugger expressions');
  }
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function str(value: MiValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function tuple(value: MiValue | undefined): MiTuple | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

export function list(value: MiValue | undefined): MiValue[] {
  return Array.isArray(value) ? value : [];
}
