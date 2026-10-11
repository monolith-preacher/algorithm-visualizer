import os from 'node:os';
import path from 'node:path';

import type { CompileResult, DebugSnapshot, ExitInfo, ServerMessage } from '@av/shared';

import { loadConfig, type Config } from '../../src/config';
import { compileProgram } from '../../src/playground/compiler';
import { Execution } from '../../src/playground/executor';
import { PlaygroundSession } from '../../src/playground/session';
import { checkSandbox, Semaphore } from '../../src/sandbox/docker';
import { Workspaces, type Workspace } from '../../src/sandbox/workspace';

export const enabled = process.env.AV_SANDBOX_TESTS === '1';

export function testConfig(): Config {
  const config = loadConfig();
  config.workDir = path.join(os.tmpdir(), `algoviz-test-${process.pid}`);
  config.limits.cpuSeconds = 2;
  config.limits.wallSeconds = 8;
  config.limits.outputKb = 64;
  return config;
}

export interface RunOutcome {
  compile: CompileResult;
  stdout: string;
  stderr: string;
  exit: ExitInfo | null;
}

/** Compiles and runs a program in the sandbox, feeding stdin up front. */
export async function compileAndRun(
  config: Config,
  workspace: Workspace,
  code: string,
  stdin = '',
  sanitizers = false,
): Promise<RunOutcome> {
  const { result, binary } = await compileProgram(config, workspace, code, 'run', { sanitizers });
  if (!binary) {
    return { compile: result, stdout: '', stderr: '', exit: null };
  }
  let stdout = '';
  let stderr = '';
  const exit = await new Promise<ExitInfo>((resolve) => {
    const execution = new Execution(config, workspace.dir, 'prog', {
      onOutput: (stream, data) => {
        if (stream === 'stdout') {
          stdout += data;
        } else {
          stderr += data;
        }
      },
      onExit: resolve,
    });
    execution.writeStdin(stdin);
    execution.closeStdin();
  });
  return { compile: result, stdout, stderr, exit };
}

/** Drives a PlaygroundSession like the browser does and records its messages. */
export class SessionDriver {
  readonly messages: ServerMessage[] = [];
  readonly session: PlaygroundSession;
  private waiters: { match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];

  constructor(config: Config, workspaces: Workspaces) {
    const status = { available: true, image: config.sandboxImage };
    this.session = new PlaygroundSession(config, workspaces, new Semaphore(4), () => status, (m) => {
      this.messages.push(m);
      this.waiters = this.waiters.filter((w) => {
        if (w.match(m)) {
          w.resolve(m);
          return false;
        }
        return true;
      });
    });
  }

  next<T extends ServerMessage['type']>(type: T, timeoutMs = 30000): Promise<Extract<ServerMessage, { type: T }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), timeoutMs);
      this.waiters.push({
        match: (m) => m.type === type,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as Extract<ServerMessage, { type: T }>);
        },
      });
    });
  }

  async paused(): Promise<DebugSnapshot> {
    return (await this.next('debug_paused')).snapshot;
  }

  output(): string {
    return this.messages
      .filter((m): m is Extract<ServerMessage, { type: 'output' }> => m.type === 'output')
      .map((m) => m.data)
      .join('');
  }
}

export async function sandboxReady(config: Config): Promise<boolean> {
  return (await checkSandbox(config)).available;
}

export { Workspaces };
