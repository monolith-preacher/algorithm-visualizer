import { spawn } from 'node:child_process';

import type { DebugCommand, DebugSnapshot, ExitInfo } from '@av/shared';

import type { Config } from '../config';
import { describeExit } from '../playground/executor';
import { signalMeaning } from '../playground/signals';
import { containerName, dockerRunArgs, killContainer } from '../sandbox/docker';
import { GdbMi, MiError } from './gdb';
import { Inspector } from './inspector';
import { str, tuple, type MiRecord, type MiTuple } from './mi';

export interface DebugCallbacks {
  onOutput(text: string): void;
  onPaused(snapshot: DebugSnapshot): void;
  onRunning(): void;
  onBreakpoints(lines: number[]): void;
  onEnded(info: ExitInfo): void;
  onError(message: string): void;
}

type State = 'starting' | 'running' | 'paused' | 'ended';

const COMMANDS: Record<Exclude<DebugCommand, 'pause'>, string> = {
  step_into: '-exec-step',
  step_over: '-exec-next',
  step_out: '-exec-finish',
  continue: '-exec-continue',
};

/**
 * A GDB/MI session debugging a user program inside a sandbox container.
 * The program's stdout and stderr are redirected to the container's stderr
 * (GDB/MI owns stdout) and its stdin comes from /box/stdin.txt.
 */
export class DebugSession {
  private state: State = 'starting';
  private readonly gdb: GdbMi;
  private readonly inspector: Inspector;
  private readonly name = containerName('dbg');
  /** Source line → GDB breakpoint number. */
  private readonly breakpoints = new Map<number, string>();
  private idleTimer: NodeJS.Timeout | null = null;
  private interruptRequested = false;
  private lastFrameFunc: string | null = null;
  private outputBytes = 0;

  constructor(
    private readonly config: Config,
    workspaceDir: string,
    binary: string,
    private readonly callbacks: DebugCallbacks,
  ) {
    const args = dockerRunArgs(config, {
      name: this.name,
      mount: workspaceDir,
      cpuLimitSeconds: Math.max(30, config.limits.cpuSeconds * 6),
      command: ['gdb', '-q', '-nx', '--interpreter=mi3', `/box/${binary}`],
    });
    const child = spawn(config.docker, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    child.on('error', (error) => this.end({ reason: 'sandbox_error', message: error.message }));
    this.gdb = new GdbMi(child);
    this.inspector = new Inspector(this.gdb);
    this.gdb.on('output', (text: string) => {
      if (text.startsWith('docker:')) {
        callbacks.onError(text.trim());
        return;
      }
      this.outputBytes += Buffer.byteLength(text);
      if (this.outputBytes > config.limits.outputKb * 1024) {
        this.end({ reason: 'output_limit' });
        return;
      }
      callbacks.onOutput(text);
    });
    this.gdb.on('exec', (record: MiRecord) => this.onExec(record));
    this.gdb.on('exit', () => this.end({ reason: 'killed' }));
    this.touch();
  }

  async start(breakpointLines: number[]): Promise<void> {
    const setup = [
      '-gdb-set mi-async on',
      '-gdb-set disable-randomization off',
      '-gdb-set confirm off',
      '-gdb-set width 0',
      '-gdb-set height 0',
      '-gdb-set print elements 200',
      '-gdb-set print null-stop on',
      '-gdb-set cwd /tmp',
      '-exec-arguments 1>&2 < /box/stdin.txt',
    ];
    try {
      for (const command of setup) {
        await this.gdb.command(command, 60000);
      }
      await this.setBreakpoints(breakpointLines);
      await this.gdb.command('-break-insert -t main');
      this.state = 'running';
      await this.gdb.command('-exec-run');
    } catch (error) {
      this.end({ reason: 'sandbox_error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  private touch(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.callbacks.onError(`Debug session closed after ${this.config.limits.debugIdleSeconds} s of inactivity`);
      this.stop();
    }, this.config.limits.debugIdleSeconds * 1000);
  }

  private onExec(record: MiRecord): void {
    if (record.klass === 'running') {
      if (this.state !== 'ended') {
        this.state = 'running';
        this.callbacks.onRunning();
      }
      return;
    }
    if (record.klass !== 'stopped') {
      return;
    }
    const r = record.results;
    const reason = str(r['reason']) ?? '';
    if (reason === 'exited-normally') {
      this.end({ reason: 'exited', exitCode: 0 });
      return;
    }
    if (reason === 'exited') {
      // GDB reports the exit status in octal.
      this.end({ reason: 'exited', exitCode: Number.parseInt(str(r['exit-code']) ?? '0', 8) });
      return;
    }
    if (reason === 'exited-signalled') {
      this.end({ reason: 'signal', signal: str(r['signal-name']) ?? null });
      return;
    }
    void this.pause(r);
  }

  private async pause(r: MiTuple): Promise<void> {
    this.state = 'paused';
    const reason = str(r['reason']) ?? '';
    const signalName = str(r['signal-name']);
    const interrupted = this.interruptRequested && (signalName === 'SIGINT' || reason === '' || reason === 'signal-received');
    this.interruptRequested = false;
    const finished = this.lastFrameFunc;
    try {
      const snapshot = await this.snapshot(interrupted ? 'paused' : reason || 'paused');
      if (signalName && !interrupted) {
        snapshot.signal = { name: signalName, meaning: signalMeaning(signalName) };
      }
      const returned = str(r['return-value']);
      if (reason === 'function-finished' && returned !== undefined && finished) {
        snapshot.returnValue = { func: finished, value: returned };
      }
      // The session may have ended (or resumed) while the snapshot was built.
      if (this.currentState() === 'paused') {
        this.callbacks.onPaused(snapshot);
      }
    } catch (error) {
      if (this.currentState() !== 'ended') {
        this.callbacks.onError(`Could not inspect the program: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  private async snapshot(reason: string): Promise<DebugSnapshot> {
    try {
      const frames = await this.inspector.frames();
      const user = frames.filter((f) => f.user);
      for (const frame of user) {
        await this.inspector.frameVariables(frame);
      }
      const globals = await this.inspector.globalVariables();
      const heap = await this.inspector.heapBlocks();
      const roots = [...globals, ...user.flatMap((f) => [...f.args, ...f.locals])];
      await this.inspector.typeHeap(heap.blocks, roots);
      const regions = await this.inspector.regions();
      const top = user[0] ?? null;
      this.lastFrameFunc = top?.func ?? null;
      return {
        reason,
        line: top?.line ?? null,
        func: top?.func ?? null,
        frames,
        globals,
        heap: heap.blocks,
        heapTracking: { available: heap.available, overflow: heap.overflow },
        regions,
      };
    } finally {
      await this.inspector.release();
    }
  }

  async command(command: DebugCommand): Promise<void> {
    this.touch();
    if (command === 'pause') {
      if (this.state === 'running') {
        this.interruptRequested = true;
        await this.gdb.command('-exec-interrupt').catch((e: Error) => this.callbacks.onError(e.message));
      }
      return;
    }
    if (this.state !== 'paused') {
      return;
    }
    try {
      await this.gdb.command(COMMANDS[command]);
    } catch (error) {
      const message = error instanceof MiError ? error.message : String(error);
      this.callbacks.onError(
        command === 'step_out' && message.includes('outermost')
          ? 'Step Out is not available in the outermost frame (main).'
          : message,
      );
    }
  }

  /** Replaces the breakpoint set; reports the lines GDB actually resolved. */
  async setBreakpoints(lines: number[]): Promise<void> {
    this.touch();
    const wanted = new Set(lines.filter((l) => Number.isInteger(l) && l > 0 && l < 100000));
    for (const [line, number] of [...this.breakpoints]) {
      if (!wanted.has(line)) {
        await this.gdb.command(`-break-delete ${number}`).catch(() => undefined);
        this.breakpoints.delete(line);
      }
    }
    for (const line of wanted) {
      if (this.breakpoints.has(line)) {
        continue;
      }
      try {
        const { record } = await this.gdb.command(`-break-insert main.c:${line}`);
        const bkpt = tuple(record.results['bkpt']);
        const number = str(bkpt?.['number']);
        const actual = Number(str(bkpt?.['line']) ?? line);
        if (number) {
          if (this.breakpoints.has(actual)) {
            await this.gdb.command(`-break-delete ${number}`).catch(() => undefined);
          } else {
            this.breakpoints.set(actual, number);
          }
        }
      } catch {
        /* No code at or after this line. */
      }
    }
    this.callbacks.onBreakpoints([...this.breakpoints.keys()].sort((a, b) => a - b));
  }

  async evaluate(expression: string, frame: number): Promise<{ value: string; type: string }> {
    this.touch();
    if (this.state !== 'paused') {
      throw new Error('The program must be paused to evaluate expressions');
    }
    try {
      const value = await this.inspector.inspect(expression, expression, frame, 1);
      if (value.error) {
        throw new Error(value.error);
      }
      return { value: value.value, type: value.type };
    } finally {
      await this.inspector.release();
    }
  }

  stop(): void {
    this.end({ reason: 'killed' });
  }

  private end(partial: Partial<ExitInfo> & { reason: string }): void {
    if (this.state === 'ended') {
      return;
    }
    this.state = 'ended';
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    const base = {
      reason: partial.reason,
      exitCode: partial.exitCode ?? null,
      signal: partial.signal ?? null,
      wallMs: null,
      cpuMs: null,
      maxRssKb: null,
    };
    const message =
      partial.reason === 'killed' ? 'Debug session stopped' : (partial.message ?? describeExit(base, this.config));
    this.callbacks.onEnded({ ...base, message });
    if (!this.gdb.isClosed) {
      void this.gdb.command('-gdb-exit', 2000).catch(() => undefined);
    }
    killContainer(this.config, this.name);
  }

  private currentState(): State {
    return this.state;
  }

  get ended(): boolean {
    return this.state === 'ended';
  }
}
