import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { StringDecoder } from 'node:string_decoder';

import { parseMiLine, str, type MiRecord } from './mi';

export class MiError extends Error {}

interface Pending {
  resolve: (record: MiRecord) => void;
  reject: (error: Error) => void;
  console: string[];
  timer: NodeJS.Timeout;
}

export interface CommandResult {
  record: MiRecord;
  /** Console stream output produced while the command ran. */
  console: string;
}

/**
 * Line-oriented GDB/MI client over a child process' stdio. Commands carry a
 * numeric token so their result records can be matched; asynchronous records
 * are emitted as events:
 *   'exec'    (*stopped, *running)
 *   'notify'  (=breakpoint-modified, …)
 *   'console' (~ stream text not attributable to a command)
 *   'output'  (inferior output, received on the container's stderr)
 *   'exit'
 */
export class GdbMi extends EventEmitter {
  private nextToken = 1;
  private readonly pending = new Map<number, Pending>();
  private buffer = '';
  private current: number | null = null;
  private closed = false;
  /** Commands are sent one at a time so console output can be attributed. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    super();
    const decoder = new StringDecoder('utf8');
    child.stdout.on('data', (chunk: Buffer) => this.onData(decoder.write(chunk)));
    const errDecoder = new StringDecoder('utf8');
    child.stderr.on('data', (chunk: Buffer) => this.emit('output', errDecoder.write(chunk)));
    child.stdin.on('error', () => undefined);
    child.on('close', (code) => {
      this.closed = true;
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new MiError('The debugger process exited'));
      }
      this.pending.clear();
      this.emit('exit', code);
    });
  }

  private onData(text: string): void {
    this.buffer += text;
    let newline = this.buffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (line.trim()) {
        this.onLine(line);
      }
      newline = this.buffer.indexOf('\n');
    }
  }

  private onLine(line: string): void {
    let record: MiRecord;
    try {
      record = parseMiLine(line);
    } catch {
      return;
    }
    switch (record.type) {
      case 'result': {
        const pending = record.token !== undefined ? this.pending.get(record.token) : undefined;
        if (!pending || record.token === undefined) {
          return;
        }
        this.pending.delete(record.token);
        if (this.current === record.token) {
          this.current = null;
        }
        clearTimeout(pending.timer);
        if (record.klass === 'error') {
          pending.reject(new MiError(str(record.results['msg']) ?? 'GDB error'));
        } else {
          pending.resolve({ ...record, text: pending.console.join('') });
        }
        return;
      }
      case 'exec':
        this.emit('exec', record);
        return;
      case 'notify':
        this.emit('notify', record);
        return;
      case 'console':
      case 'target': {
        const pending = this.current !== null ? this.pending.get(this.current) : undefined;
        if (pending) {
          pending.console.push(record.text ?? '');
        } else {
          this.emit('console', record.text ?? '');
        }
        return;
      }
      default:
        return;
    }
  }

  /** Sends one MI command (after any pending one) and waits for its result record. */
  command(command: string, timeoutMs = 15000): Promise<CommandResult> {
    const run = this.queue.then(
      () => this.send(command, timeoutMs),
      () => this.send(command, timeoutMs),
    );
    this.queue = run.catch(() => undefined);
    return run;
  }

  private send(command: string, timeoutMs: number): Promise<CommandResult> {
    if (this.closed) {
      return Promise.reject(new MiError('The debugger is not running'));
    }
    const token = this.nextToken++;
    return new Promise<MiRecord>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(token);
        reject(new MiError(`GDB did not answer: ${command.split(' ')[0]}`));
      }, timeoutMs);
      this.pending.set(token, { resolve, reject, console: [], timer });
      this.current = token;
      this.child.stdin.write(`${token}${command}\n`);
    }).then((record) => ({ record, console: record.text ?? '' }));
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
