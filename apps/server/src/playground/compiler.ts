import type { CompileOptions, CompileResult } from '@av/shared';

import type { Config } from '../config';
import { containerName, dockerRunArgs, killContainer } from '../sandbox/docker';
import { runCaptured } from '../sandbox/process';
import type { Workspace } from '../sandbox/workspace';
import { parseDiagnostics } from './diagnostics';

export type BuildMode = 'run' | 'debug';

const COMMON_FLAGS = ['-std=gnu17', '-Wall', '-Wextra', '-fdiagnostics-color=never', '-fmax-errors=30'];

/** GCC arguments (after the source file) for each build mode. */
export function gccFlags(mode: BuildMode, options: CompileOptions): string[] {
  if (mode === 'debug') {
    return [
      ...COMMON_FLAGS,
      '-g',
      '-O0',
      '-fno-omit-frame-pointer',
      '-o',
      '/tmp/prog',
      'main.c',
      // Allocation tracker read by the debugger (sandbox/avrt.c).
      '/opt/av/avrt_debug.o',
      '-Wl,--wrap=malloc,--wrap=free,--wrap=calloc,--wrap=realloc',
      '-lm',
    ];
  }
  const optimization = options.sanitizers
    ? ['-g', '-O1', '-fsanitize=address,undefined', '-fno-omit-frame-pointer']
    : ['-g', '-O2'];
  return [...COMMON_FLAGS, ...optimization, '-o', '/tmp/prog', 'main.c', '/opt/av/avrt.o', '-lm'];
}

/**
 * Inside the sandbox: read the source from stdin into /tmp/main.c, compile it
 * (diagnostics on stderr) and stream the binary back on stdout. The script is
 * constant; GCC arguments are passed as positional parameters.
 */
const COMPILE_SCRIPT = 'cat > /tmp/main.c && cd /tmp && gcc "$@" 1>&2 && cat /tmp/prog';

const COMPILE_TIMEOUT_MS = 30000;
const MAX_BINARY_BYTES = 32 * 1024 * 1024;

export interface CompileOutcome {
  result: CompileResult;
  /** Path of the binary inside the workspace (only when compilation succeeded). */
  binary: string | null;
}

export async function compileProgram(
  config: Config,
  workspace: Workspace,
  code: string,
  mode: BuildMode,
  options: CompileOptions,
): Promise<CompileOutcome> {
  const flags = gccFlags(mode, options);
  const name = containerName('cc');
  const started = Date.now();
  const proc = await runCaptured(
    config.docker,
    dockerRunArgs(config, { name, cpuLimitSeconds: 25, command: ['sh', '-c', COMPILE_SCRIPT, 'sh', ...flags] }),
    {
      input: code,
      timeoutMs: COMPILE_TIMEOUT_MS,
      maxOutputBytes: MAX_BINARY_BYTES,
      onKill: () => killContainer(config, name),
    },
  );
  const output = proc.stderr.toString('utf8');
  const durationMs = Date.now() - started;
  const command = `gcc ${flags.join(' ')}`;
  const ok = proc.code === 0 && !proc.timedOut && !proc.overflow && proc.stdout.length > 0;

  let message = output;
  if (proc.timedOut) {
    message += `\nCompilation exceeded ${COMPILE_TIMEOUT_MS / 1000} s and was stopped.`;
  } else if (proc.overflow) {
    message += '\nCompiler output exceeded the size limit.';
  } else if (proc.code !== 0 && output.trim() === '') {
    message = `Compilation failed (exit status ${proc.code ?? 'unknown'}).`;
  }

  const result: CompileResult = {
    ok,
    mode,
    diagnostics: parseDiagnostics(output),
    output: message.trimEnd(),
    durationMs,
    command,
  };
  if (!ok) {
    return { result, binary: null };
  }
  const binary = await workspace.write(mode === 'debug' ? 'prog-debug' : 'prog', proc.stdout, 0o755);
  return { result, binary };
}
