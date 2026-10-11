import type { Diagnostic } from '@av/shared';

const LOCATED = /^(?:\/tmp\/)?main\.c:(\d+):(\d+):\s+(fatal error|error|warning|note):\s+(.*)$/;
const LINKER = /(undefined reference to .*|multiple definition of .*|ld returned \d+ exit status)/;

/** Extracts GCC diagnostics (-fdiagnostics-color=never) located in main.c. */
export function parseDiagnostics(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split('\n')) {
    const match = LOCATED.exec(line);
    if (match) {
      const [, row, col, severity, message] = match;
      diagnostics.push({
        line: Number(row),
        column: Number(col),
        severity: severity === 'fatal error' ? 'error' : (severity as Diagnostic['severity']),
        message: (message ?? '').trim(),
      });
      continue;
    }
    const linker = LINKER.exec(line);
    if (linker && !line.includes('collect2')) {
      diagnostics.push({ line: 1, column: 1, severity: 'error', message: `linker: ${linker[1]}` });
    }
  }
  return diagnostics;
}
