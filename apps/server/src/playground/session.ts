import { z } from 'zod';

import type { ClientMessage, CompileOptions, SandboxStatus, ServerMessage, SessionPhase } from '@av/shared';

import type { Config } from '../config';
import { DebugSession } from '../debugger/session';
import type { Semaphore } from '../sandbox/docker';
import type { Workspace, Workspaces } from '../sandbox/workspace';
import { compileProgram, type BuildMode } from './compiler';
import { Execution } from './executor';

const code = z.string();
const options = z.object({ sanitizers: z.boolean() });
const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('compile'), code, options }),
  z.object({ type: z.literal('run'), code, options }),
  z.object({ type: z.literal('stdin'), data: z.string().max(65536) }),
  z.object({ type: z.literal('stdin_eof') }),
  z.object({ type: z.literal('stop') }),
  z.object({
    type: z.literal('debug_start'),
    code,
    stdin: z.string().max(1 << 20),
    breakpoints: z.array(z.number().int().positive()).max(256),
  }),
  z.object({
    type: z.literal('debug_command'),
    command: z.enum(['step_into', 'step_over', 'step_out', 'continue', 'pause']),
  }),
  z.object({ type: z.literal('debug_breakpoints'), lines: z.array(z.number().int().positive()).max(256) }),
  z.object({
    type: z.literal('debug_evaluate'),
    id: z.number().int(),
    expression: z.string().min(1).max(512),
    frame: z.number().int().min(0).max(64),
  }),
  z.object({ type: z.literal('debug_stop') }),
]);

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const result = messageSchema.safeParse(JSON.parse(raw));
    return result.success ? (result.data as ClientMessage) : null;
  } catch {
    return null;
  }
}

/**
 * State of one browser connection to the C Playground. At most one compile,
 * run or debug session is active per connection.
 */
export class PlaygroundSession {
  private phase: SessionPhase = 'idle';
  private workspace: Workspace | null = null;
  private execution: Execution | null = null;
  private debug: DebugSession | null = null;
  private release: (() => void) | null = null;
  private disposed = false;

  constructor(
    private readonly config: Config,
    private readonly workspaces: Workspaces,
    private readonly semaphore: Semaphore,
    private readonly sandbox: () => SandboxStatus,
    private readonly send: (message: ServerMessage) => void,
  ) {}

  private setPhase(phase: SessionPhase): void {
    this.phase = phase;
    this.send({ type: 'phase', phase });
  }

  private error(message: string): void {
    this.send({ type: 'error', message });
  }

  async handle(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case 'compile':
        return this.compileOnly(message.code, message.options);
      case 'run':
        return this.run(message.code, message.options);
      case 'stdin':
        this.execution?.writeStdin(message.data);
        return;
      case 'stdin_eof':
        this.execution?.closeStdin();
        return;
      case 'stop':
        this.execution?.kill();
        this.debug?.stop();
        return;
      case 'debug_start':
        return this.startDebug(message.code, message.stdin, message.breakpoints);
      case 'debug_command':
        await this.debug?.command(message.command);
        return;
      case 'debug_breakpoints':
        await this.debug?.setBreakpoints(message.lines);
        return;
      case 'debug_evaluate': {
        if (!this.debug) {
          return;
        }
        try {
          const result = await this.debug.evaluate(message.expression, message.frame);
          this.send({ type: 'debug_eval', id: message.id, expression: message.expression, value: result.value, valueType: result.type });
        } catch (error) {
          this.send({
            type: 'debug_eval',
            id: message.id,
            expression: message.expression,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }
      case 'debug_stop':
        this.debug?.stop();
        return;
    }
  }

  /** Validates preconditions and reserves a sandbox slot. */
  private async begin(source: string): Promise<boolean> {
    if (this.phase !== 'idle') {
      this.error('Another operation is in progress. Stop it first.');
      return false;
    }
    const status = this.sandbox();
    if (!status.available) {
      this.error(`Sandbox unavailable: ${status.reason ?? 'unknown reason'}`);
      return false;
    }
    if (Buffer.byteLength(source) > this.config.limits.sourceKb * 1024) {
      this.error(`Source exceeds ${this.config.limits.sourceKb} KB`);
      return false;
    }
    this.setPhase('compiling');
    this.release = await this.semaphore.acquire();
    if (!this.workspace) {
      this.workspace = await this.workspaces.create();
    }
    return true;
  }

  private finish(): void {
    this.release?.();
    this.release = null;
    this.execution = null;
    this.debug = null;
    if (!this.disposed) {
      this.setPhase('idle');
    }
  }

  private async compile(source: string, mode: BuildMode, options: CompileOptions): Promise<string | null> {
    if (!this.workspace) {
      return null;
    }
    try {
      const outcome = await compileProgram(this.config, this.workspace, source, mode, options);
      this.send({ type: 'compile_result', result: outcome.result });
      return outcome.binary ? (mode === 'debug' ? 'prog-debug' : 'prog') : null;
    } catch (error) {
      this.error(`Compilation failed to start: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  private async compileOnly(source: string, options: CompileOptions): Promise<void> {
    if (!(await this.begin(source))) {
      return;
    }
    await this.compile(source, 'run', options);
    this.finish();
  }

  private async run(source: string, options: CompileOptions): Promise<void> {
    if (!(await this.begin(source))) {
      return;
    }
    const binary = await this.compile(source, 'run', options);
    if (!binary || !this.workspace || this.disposed) {
      this.finish();
      return;
    }
    this.setPhase('running');
    this.execution = new Execution(this.config, this.workspace.dir, binary, {
      onOutput: (stream, data) => this.send({ type: 'output', stream, data }),
      onExit: (info) => {
        this.send({ type: 'exit', info });
        this.finish();
      },
    });
  }

  private async startDebug(source: string, stdin: string, breakpoints: number[]): Promise<void> {
    if (!(await this.begin(source))) {
      return;
    }
    const binary = await this.compile(source, 'debug', { sanitizers: false });
    if (!binary || !this.workspace || this.disposed) {
      this.finish();
      return;
    }
    await this.workspace.write('stdin.txt', stdin);
    this.setPhase('debugging');
    const session = new DebugSession(this.config, this.workspace.dir, binary, {
      onOutput: (data) => this.send({ type: 'output', stream: 'stdout', data }),
      onPaused: (snapshot) => this.send({ type: 'debug_paused', snapshot }),
      onRunning: () => this.send({ type: 'debug_running' }),
      onBreakpoints: (lines) => this.send({ type: 'debug_breakpoints', lines }),
      onError: (message) => this.error(message),
      onEnded: (info) => {
        this.send({ type: 'debug_ended', info });
        if (this.debug === session) {
          this.finish();
        }
      },
    });
    this.debug = session;
    await session.start(breakpoints);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.execution?.kill();
    this.debug?.stop();
    this.release?.();
    this.release = null;
    await this.workspace?.dispose();
    this.workspace = null;
  }
}
