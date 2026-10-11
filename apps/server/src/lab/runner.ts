import fs from 'node:fs/promises';
import path from 'node:path';

import { findAlgorithm, parseTrace, type BenchResponse, type TraceEvent } from '@av/shared';

import type { Config } from '../config';
import { Semaphore } from '../sandbox/docker';
import { runCaptured } from '../sandbox/process';

export class LabError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const TRACE_TIMEOUT_MS = 10000;
const BENCH_TIMEOUT_MS = 15000;
const MAX_TRACE_BYTES = 64 * 1024 * 1024;

/**
 * Runs the Algorithm Lab binaries built from clib/. These execute only the
 * repository's own C code on validated numeric input, so they run as plain
 * child processes (no shell) with time and output limits, not in the sandbox.
 */
export class LabRunner {
  private readonly slots = new Semaphore(4);

  constructor(private readonly config: Config) {}

  private binary(name: 'avlab' | 'avbench'): string {
    return path.join(this.config.clibDir, 'build', name);
  }

  async status(): Promise<{ available: boolean; reason?: string }> {
    try {
      await fs.access(this.binary('avlab'), fs.constants.X_OK);
      await fs.access(this.binary('avbench'), fs.constants.X_OK);
      return { available: true };
    } catch {
      return { available: false, reason: 'C library not built. Run: make -C clib' };
    }
  }

  async source(id: string): Promise<{ source: string; header: string }> {
    const algorithm = findAlgorithm(id);
    if (!algorithm) {
      throw new LabError(`Unknown algorithm: ${id}`, 'unknown_algorithm', 404);
    }
    const root = path.join(this.config.clibDir, 'src');
    const [source, header] = await Promise.all([
      fs.readFile(path.join(root, algorithm.source), 'utf8'),
      fs.readFile(path.join(root, algorithm.header), 'utf8'),
    ]);
    return { source, header };
  }

  async trace(id: string, input: string, traceFrom?: number): Promise<TraceEvent[]> {
    if (!findAlgorithm(id)) {
      throw new LabError(`Unknown algorithm: ${id}`, 'unknown_algorithm', 404);
    }
    const args = [id];
    if (traceFrom !== undefined) {
      args.push('--trace-from', String(traceFrom));
    }
    const release = await this.slots.acquire();
    try {
      const proc = await runCaptured(this.binary('avlab'), args, {
        input,
        timeoutMs: TRACE_TIMEOUT_MS,
        maxOutputBytes: MAX_TRACE_BYTES,
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
      });
      if (proc.timedOut || proc.overflow) {
        throw new LabError('The trace exceeded the time or size limit', 'limit', 422);
      }
      const events = parseTrace(proc.stdout.toString('utf8'));
      const error = events.find((e) => e.t === 'error');
      if (error && error.t === 'error') {
        throw new LabError(error.message, error.code, 422);
      }
      if (proc.code !== 0) {
        throw new LabError(`avlab exited with status ${proc.code}`, 'internal', 500);
      }
      return events;
    } finally {
      release();
    }
  }

  async bench(id: string, input: string): Promise<BenchResponse> {
    const algorithm = findAlgorithm(id);
    if (!algorithm || (algorithm.module !== 'sorting' && algorithm.module !== 'searching')) {
      throw new LabError(`Timing is not available for ${id}`, 'unsupported', 400);
    }
    const release = await this.slots.acquire();
    try {
      const proc = await runCaptured(this.binary('avbench'), [id], {
        input,
        timeoutMs: BENCH_TIMEOUT_MS,
        maxOutputBytes: 65536,
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
      });
      const parsed = JSON.parse(proc.stdout.toString('utf8') || '{}') as BenchResponse & { error?: string };
      if (proc.code !== 0 || parsed.error) {
        throw new LabError(`Benchmark failed: ${parsed.error ?? `status ${proc.code}`}`, parsed.error ?? 'internal', 422);
      }
      return parsed;
    } finally {
      release();
    }
  }
}
