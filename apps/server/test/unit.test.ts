import { describe, expect, it } from 'vitest';

import { classifyType, parseAddress, pointeeType } from '../src/debugger/inspector';
import { miQuote, parseMiLine } from '../src/debugger/mi';
import { parseDiagnostics } from '../src/playground/diagnostics';
import { StatusFilter } from '../src/playground/executor';

describe('GDB/MI parser', () => {
  it('parses result records with nested tuples and lists', () => {
    const r = parseMiLine(
      '12^done,stack=[frame={level="0",func="main",line="5"},frame={level="1",func="f"}],x=["a","b"],empty={}',
    );
    expect(r.type).toBe('result');
    expect(r.token).toBe(12);
    expect(r.klass).toBe('done');
    expect(r.results['stack']).toEqual([{ level: '0', func: 'main', line: '5' }, { level: '1', func: 'f' }]);
    expect(r.results['x']).toEqual(['a', 'b']);
    expect(r.results['empty']).toEqual({});
  });

  it('decodes C string escapes including octal UTF-8 bytes', () => {
    const r = parseMiLine('~"caf\\303\\251 \\"q\\"\\n"');
    expect(r.type).toBe('console');
    expect(r.text).toBe('café "q"\n');
  });

  it('parses async records', () => {
    const r = parseMiLine('*stopped,reason="signal-received",signal-name="SIGSEGV",frame={func="main"}');
    expect(r.type).toBe('exec');
    expect(r.klass).toBe('stopped');
    expect(r.results['signal-name']).toBe('SIGSEGV');
  });

  it('quotes expressions and rejects control characters', () => {
    expect(miQuote('a "b" \\ c')).toBe('"a \\"b\\" \\\\ c"');
    expect(() => miQuote('x\n-gdb-exit')).toThrow();
  });
});

describe('inspector helpers', () => {
  it('classifies C types', () => {
    expect(classifyType('int')).toBe('scalar');
    expect(classifyType('int [5]')).toBe('array');
    expect(classifyType('struct Node *')).toBe('pointer');
    expect(classifyType('struct Node')).toBe('struct');
    expect(classifyType('int (*)(int, int)')).toBe('function');
  });

  it('extracts addresses and pointee types', () => {
    expect(parseAddress('0x5555deadbeef "hi"')).toBe('0x5555deadbeef');
    expect(parseAddress('0x0')).toBeNull();
    expect(pointeeType('const struct Node *')).toBe('struct Node');
    expect(pointeeType('void *')).toBeNull();
    expect(pointeeType('int **')).toBe('int *');
  });
});

describe('compiler diagnostics', () => {
  it('extracts located errors and warnings', () => {
    const out = [
      "main.c: In function 'main':",
      "main.c:3:13: error: expected expression before ';' token",
      '    3 |     int x = ;',
      "main.c:2:9: warning: unused variable 'y' [-Wunused-variable]",
      "/usr/bin/ld: /tmp/cc.o: in function `main': undefined reference to `foo'",
    ].join('\n');
    const d = parseDiagnostics(out);
    expect(d[0]).toEqual({ line: 3, column: 13, severity: 'error', message: "expected expression before ';' token" });
    expect(d[1]?.severity).toBe('warning');
    expect(d[2]?.message).toContain('undefined reference');
  });
});

describe('avrun status filter', () => {
  it('removes the status record even when split across chunks', () => {
    const filter = new StatusFilter('tok');
    const record = '\x1e@@AVSTATUS:tok:{"reason":"exited","exitCode":0,"signal":null,"wallMs":1,"cpuMs":1,"maxRssKb":1}\n';
    const text = `error output\n${record}`;
    let visible = '';
    for (const ch of text) {
      visible += filter.push(ch);
    }
    visible += filter.flush();
    expect(visible).toBe('error output\n');
    expect(filter.result()?.reason).toBe('exited');
  });

  it('ignores forged records with another token', () => {
    const filter = new StatusFilter('secret');
    const forged = '\x1e@@AVSTATUS:guess:{"reason":"exited"}\n';
    expect(filter.push(forged) + filter.flush()).toBe(forged);
    expect(filter.result()).toBeNull();
  });
});
