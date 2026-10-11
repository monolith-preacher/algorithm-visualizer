import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

import type { ExitInfo } from '@av/shared';

import type { Config } from '../config';
import { containerName, dockerRunArgs, killContainer } from '../sandbox/docker';
import { signalMeaning } from './signals';

interface AvrunStatus {
  reason: string;
  exitCode: number;
  signal: string | null;
  wallMs: number;
  cpuMs: number;
  maxRssKb: number;
}

export interface ExecutionCallbacks {
  onOutput(stream: 'stdout' | 'stderr', data: string): void;
  onExit(info: ExitInfo): void;
}

/**
 * Removes the avrun status record from the stderr stream. The record is the
 * last thing avrun writes, but chunks may split it anywhere, so a suffix that
 * could be the beginning of the marker is held back until more data arrives.
 */
export class StatusFilter {
  private pending = '';
  private status: AvrunStatus | null = null;
  private readonly marker: string;

  constructor(token: string) {
    this.marker = `\x1e@@AVSTATUS:${token}:`;
  }

  push(text: string): string {
    if (this.status) {
      return text;
    }
    this.pending += text;
    const index = this.pending.indexOf(this.marker);
    if (index >= 0) {
      const end = this.pending.indexOf('\n', index);
      if (end < 0) {
        const before = this.pending.slice(0, index);
        this.pending = this.pending.slice(index);
        return before;
      }
      const json = this.pending.slice(index + this.marker.length, end);
      const before = this.pending.slice(0, index);
      const after = this.pending.slice(end + 1);
      this.pending = '';
      try {
        this.status = JSON.parse(json) as AvrunStatus;
      } catch {
        return before + after;
      }
      return before + after;
    }
    let keep = 0;
    for (let len = Math.min(this.marker.length - 1, this.pending.length); len > 0; len--) {
      if (this.marker.startsWith(this.pending.slice(this.pending.length - len))) {
        keep = len;
        break;
      }
    }
    const out = this.pending.slice(0, this.pending.length - keep);
    this.pending = this.pending.slice(this.pending.length - keep);
    return out;
  }

  flush(): string {
    const rest = this.pending;
    this.pending = '';
    return rest;
  }

  result(): AvrunStatus | null {
    return this.status;
  }
}

export function describeExit(info: Omit<ExitInfo, 'message'>, config: Config): string {
  switch (info.reason) {
    case 'exited':
      return `Process exited with code ${info.exitCode ?? '?'}`;
    case 'signal': {
      const name = info.signal ?? 'unknown signal';
      const memoryHint =
        name === 'SIGKILL' ? ` (likely exceeded the ${config.limits.memoryMb} MB memory limit)` : '';
      return `Process terminated by ${name}: ${signalMeaning(name)}${memoryHint}`;
    }
    case 'cpu_limit':
      return `CPU time limit exceeded (${config.limits.cpuSeconds} s): the program was stopped`;
    case 'wall_timeout':
      return `Wall-clock limit exceeded (${config.limits.wallSeconds} s): the program was stopped`;
    case 'file_size_limit':
      return 'File size limit exceeded: the program was stopped';
    case 'output_limit':
      return `Output limit exceeded (${config.limits.outputKb} KB): the program was stopped`;
    case 'killed':
      return 'Stopped by user';
    default:
      return 'The sandbox failed to run the program';
  }
}

/** A user program running inside a sandbox container, with streamed I/O. */
export class Execution {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly name = containerName('run');
  private readonly filter: StatusFilter;
  private killReason: string | null = null;
  private outputBytes = 0;
  private readonly timer: NodeJS.Timeout;
  private dockerError = '';
  private finished = false;

  constructor(
    private readonly config: Config,
    workspaceDir: string,
    binary: string,
    private readonly callbacks: ExecutionCallbacks,
  ) {
    const token = randomBytes(16).toString('hex');
    this.filter = new StatusFilter(token);
    const { limits } = config;
    const args = dockerRunArgs(config, {
      name: this.name,
      mount: workspaceDir,
      command: [
        '/opt/av/avrun',
        '--token',
        token,
        '--cpu-sec',
        String(limits.cpuSeconds),
        '--wall-ms',
        String(limits.wallSeconds * 1000),
        '--fsize-kb',
        '8192',
        '--',
        `/box/${binary}`,
      ],
    });
    this.child = spawn(config.docker, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    // Safety net in case avrun cannot enforce its own timeout (container start included).
    this.timer = setTimeout(() => this.kill('wall_timeout'), (limits.wallSeconds + 10) * 1000);

    const stdout = new StringDecoder('utf8');
    const stderr = new StringDecoder('utf8');
    this.child.stdout.on('data', (chunk: Buffer) => this.emit('stdout', stdout.write(chunk), chunk.length));
    this.child.stderr.on('data', (chunk: Buffer) => {
      const text = this.filter.push(stderr.write(chunk));
      this.emit('stderr', text, Buffer.byteLength(text));
    });
    this.child.stdin.on('error', () => undefined);
    this.child.on('error', (error) => {
      this.dockerError = error.message;
    });
    this.child.on('close', () => {
      const rest = this.filter.flush();
      if (rest) {
        this.emit('stderr', rest, Buffer.byteLength(rest));
      }
      this.finish();
    });
  }

  private emit(stream: 'stdout' | 'stderr', text: string, bytes: number): void {
    if (!text || this.killReason === 'output_limit') {
      return;
    }
    this.outputBytes += bytes;
    if (this.outputBytes > this.config.limits.outputKb * 1024) {
      this.kill('output_limit');
      return;
    }
    // Docker reports its own failures on stderr before the program starts.
    if (stream === 'stderr' && this.outputBytes === bytes && text.startsWith('docker:')) {
      this.dockerError += text;
      return;
    }
    this.callbacks.onOutput(stream, text);
  }

  private finish(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    clearTimeout(this.timer);
    const status = this.filter.result();
    let base: Omit<ExitInfo, 'message'>;
    if (this.killReason) {
      base = { reason: this.killReason, exitCode: null, signal: null, wallMs: null, cpuMs: null, maxRssKb: null };
    } else if (status) {
      base = {
        reason: status.reason,
        exitCode: status.exitCode >= 0 ? status.exitCode : null,
        signal: status.signal,
        wallMs: status.wallMs,
        cpuMs: status.cpuMs,
        maxRssKb: status.maxRssKb,
      };
    } else {
      base = { reason: 'sandbox_error', exitCode: null, signal: null, wallMs: null, cpuMs: null, maxRssKb: null };
    }
    let message = describeExit(base, this.config);
    if (base.reason === 'sandbox_error' && this.dockerError) {
      message += `: ${this.dockerError.trim()}`;
    }
    this.callbacks.onExit({ ...base, message });
  }

  writeStdin(data: string): void {
    if (!this.finished && this.child.stdin.writable) {
      this.child.stdin.write(data);
    }
  }

  closeStdin(): void {
    if (!this.finished) {
      this.child.stdin.end();
    }
  }

  kill(reason = 'killed'): void {
    if (this.finished || this.killReason) {
      return;
    }
    this.killReason = reason;
    killContainer(this.config, this.name);
    // If the container never started, the docker client itself must go.
    setTimeout(() => this.child.kill('SIGKILL'), 3000).unref();
  }

  get done(): boolean {
    return this.finished;
  }
}
