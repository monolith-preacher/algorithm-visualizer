/**
 * Maps between an instrumented C source file and the clean view shown in the
 * UI. Instrumentation lines (TRACE_* statements and the av_trace.h include)
 * are hidden in the clean view; an event raised by a trace statement refers
 * to the first code line below it.
 */

const TRACE_LINE = /^\s*TRACE_[A-Z_]+\(.*\);\s*$/;
const TRACE_INCLUDE = /^\s*#include\s+"av_trace\.h"\s*$/;

export interface SourceMap {
  /** Original file, 1-based line numbers as reported by __LINE__. */
  readonly rawLines: readonly string[];
  /** Clean view (instrumentation removed). */
  readonly cleanText: string;
  /** Line numbers (raw, 1-based) of instrumentation lines. */
  readonly instrumentation: ReadonlySet<number>;
  /** Raw code line → clean line (1-based). Instrumentation lines map to the next code line. */
  toClean(rawLine: number): number | null;
  /** Code line an event raised at rawLine refers to (raw numbering). */
  resolve(rawLine: number): number | null;
  /** Line of a function's signature, if found. */
  signatureLine(fn: string): number | null;
  /** Line of the closing brace of a function body, if found. */
  closingLine(fn: string): number | null;
  /** Declared return type of a function (e.g. "bool", "int"), if found. */
  returnType(fn: string): string | null;
}

export function isInstrumentationLine(text: string): boolean {
  return TRACE_LINE.test(text) || TRACE_INCLUDE.test(text);
}

export function analyzeSource(text: string): SourceMap {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n');
  const instrumentation = new Set<number>();
  const rawToClean = new Array<number | null>(rawLines.length + 2).fill(null);
  const clean: string[] = [];

  rawLines.forEach((line, index) => {
    const lineNo = index + 1;
    if (isInstrumentationLine(line)) {
      instrumentation.add(lineNo);
      return;
    }
    clean.push(line);
    rawToClean[lineNo] = clean.length;
  });

  const resolve = (rawLine: number): number | null => {
    if (rawLine < 1 || rawLine > rawLines.length) {
      return null;
    }
    let line = rawLine;
    while (line <= rawLines.length && instrumentation.has(line)) {
      line++;
    }
    return line <= rawLines.length ? line : null;
  };

  const signatures = new Map<string, { line: number; returnType: string }>();
  const signatureRe = /^([A-Za-z_][\w\s*]*?)\s*\**\b([A-Za-z_]\w*)\s*\([^;]*$/;
  rawLines.forEach((line, index) => {
    if (/^\s/.test(line) || line.startsWith('#') || line.startsWith('/')) {
      return;
    }
    const match = signatureRe.exec(line);
    if (match && match[1] && match[2] && !signatures.has(match[2])) {
      const returnType = match[1].replace(/\bstatic\b|\binline\b/g, '').trim();
      signatures.set(match[2], { line: index + 1, returnType });
    }
  });

  const closingLine = (fn: string): number | null => {
    const sig = signatures.get(fn);
    if (!sig) {
      return null;
    }
    let depth = 0;
    let opened = false;
    for (let i = sig.line - 1; i < rawLines.length; i++) {
      for (const ch of rawLines[i] ?? '') {
        if (ch === '{') {
          depth++;
          opened = true;
        } else if (ch === '}') {
          depth--;
          if (opened && depth === 0) {
            return i + 1;
          }
        }
      }
    }
    return null;
  };

  return {
    rawLines,
    cleanText: clean.join('\n'),
    instrumentation,
    toClean: (rawLine) => {
      const code = resolve(rawLine);
      return code === null ? null : (rawToClean[code] ?? null);
    },
    resolve,
    signatureLine: (fn) => signatures.get(fn)?.line ?? null,
    closingLine,
    returnType: (fn) => signatures.get(fn)?.returnType ?? null,
  };
}
