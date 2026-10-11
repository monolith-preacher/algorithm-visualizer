import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

import type { SandboxStatus } from '@av/shared';

import type { Config } from '../config';
import { runCaptured } from './process';

export const SANDBOX_LABEL = 'algoviz.sandbox=1';

export interface ContainerSpec {
  name: string;
  /** Host directory mounted read-only at /box (never writable by the sandbox). */
  mount?: string;
  /** Extra RLIMIT_CPU for every process in the container (seconds). */
  cpuLimitSeconds?: number;
  workdir?: string;
  command: string[];
}

/**
 * Builds the `docker run` argument vector for an isolated, short-lived
 * container. The sandbox has no network, a read-only root filesystem, a small
 * tmpfs, no capabilities, no privilege escalation, an unprivileged uid and
 * cgroup limits on memory, CPU and process count.
 */
export function dockerRunArgs(config: Config, spec: ContainerSpec): string[] {
  const { limits } = config;
  const args = [
    'run',
    '--rm',
    '-i',
    '--name',
    spec.name,
    '--label',
    SANDBOX_LABEL,
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,exec,nosuid,nodev,size=64m',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    String(limits.pids),
    '--memory',
    `${limits.memoryMb}m`,
    '--memory-swap',
    `${limits.memoryMb}m`,
    '--cpus',
    '1',
    '--ulimit',
    'core=0',
    '--ulimit',
    'nofile=256:256',
    '--user',
    '65534:65534',
    '--init',
    '--workdir',
    spec.workdir ?? '/tmp',
    '--env',
    'HOME=/tmp',
  ];
  if (spec.cpuLimitSeconds !== undefined) {
    args.push('--ulimit', `cpu=${spec.cpuLimitSeconds}:${spec.cpuLimitSeconds + 1}`);
  }
  if (spec.mount) {
    args.push('--mount', `type=bind,source=${spec.mount},target=/box,readonly`);
  }
  args.push(config.sandboxImage, ...spec.command);
  return args;
}

export function containerName(kind: string): string {
  return `algoviz-${kind}-${randomBytes(6).toString('hex')}`;
}

/** Stops a container; errors are ignored because it may already be gone. */
export function killContainer(config: Config, name: string): void {
  const child = spawn(config.docker, ['kill', name], { stdio: 'ignore' });
  child.on('error', () => undefined);
}

export async function checkSandbox(config: Config): Promise<SandboxStatus> {
  const base = { image: config.sandboxImage };
  try {
    const version = await runCaptured(config.docker, ['version', '--format', '{{.Server.Version}}'], {
      timeoutMs: 10000,
      maxOutputBytes: 65536,
    });
    if (version.code !== 0) {
      const detail = version.stderr.toString().trim().split('\n')[0] ?? '';
      return { ...base, available: false, reason: `Docker daemon is not reachable: ${detail}` };
    }
    const image = await runCaptured(config.docker, ['image', 'inspect', '--format', '{{.Id}}', config.sandboxImage], {
      timeoutMs: 10000,
      maxOutputBytes: 65536,
    });
    if (image.code !== 0) {
      return {
        ...base,
        available: false,
        reason: `Sandbox image ${config.sandboxImage} not found. Build it with: npm run build:sandbox`,
      };
    }
    return { ...base, available: true };
  } catch {
    return { ...base, available: false, reason: `Docker CLI "${config.docker}" not found. Install Docker Engine.` };
  }
}

/** Removes containers left behind by a previous server process. */
export async function removeStaleContainers(config: Config): Promise<void> {
  try {
    const list = await runCaptured(config.docker, ['ps', '-aq', '--filter', `label=${SANDBOX_LABEL}`], {
      timeoutMs: 10000,
      maxOutputBytes: 1 << 20,
    });
    const ids = list.stdout.toString().split(/\s+/).filter(Boolean);
    if (ids.length > 0) {
      await runCaptured(config.docker, ['rm', '-f', ...ids], { timeoutMs: 30000, maxOutputBytes: 1 << 20 });
    }
  } catch {
    /* Docker unavailable: nothing to clean. */
  }
}

/** Bounds the number of sandbox containers running at the same time. */
export class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly capacity: number) {}

  async acquire(): Promise<() => void> {
    if (this.active >= this.capacity) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.active--;
      this.waiting.shift()?.();
    };
  }
}
