import { spawn, type ChildProcess } from 'node:child_process';

export interface CapturedProcess {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
  timedOut: boolean;
  /** Output exceeded maxOutputBytes and the process was killed. */
  overflow: boolean;
}

export interface CaptureOptions {
  input?: string | Buffer;
  timeoutMs: number;
  maxOutputBytes: number;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  /** Called instead of SIGKILL to stop the process (e.g. docker kill). */
  onKill?: () => void;
}

/**
 * Runs a program without a shell and collects its output with hard limits on
 * time and size. Arguments are passed as an array, so no shell parsing occurs.
 */
export function runCaptured(command: string, args: string[], options: CaptureOptions): Promise<CapturedProcess> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: options.env ?? process.env,
        cwd: options.cwd,
      });
    } catch (error) {
      reject(error);
      return;
    }
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let size = 0;
    let timedOut = false;
    let overflow = false;
    let settled = false;

    const kill = (): void => {
      if (options.onKill) {
        options.onKill();
      }
      child.kill('SIGKILL');
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, options.timeoutMs);

    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      size += chunk.length;
      if (size > options.maxOutputBytes) {
        if (!overflow) {
          overflow = true;
          kill();
        }
        return;
      }
      target.push(chunk);
    };
    child.stdout?.on('data', collect(stdout));
    child.stderr?.on('data', collect(stderr));
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({
          code,
          signal,
          stdout: Buffer.concat(stdout),
          stderr: Buffer.concat(stderr),
          timedOut,
          overflow,
        });
      }
    });
    child.stdin?.on('error', () => {
      /* The process may exit before consuming its input. */
    });
    child.stdin?.end(options.input ?? '');
  });
}
