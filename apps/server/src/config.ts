import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExecutionLimits } from '@av/shared';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// Optional .env at the repository root (variables already set take precedence).
const envFile = path.join(repoRoot, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: expected an integer in [${min}, ${max}], got "${raw}"`);
  }
  return value;
}

export interface Config {
  host: string;
  port: number;
  /** Allowed browser origins for WebSocket connections (empty: same host only). */
  allowedOrigins: string[];
  clibDir: string;
  webDist: string;
  docker: string;
  sandboxImage: string;
  workDir: string;
  maxConcurrentSandboxes: number;
  limits: ExecutionLimits;
}

export function loadConfig(): Config {
  return {
    host: process.env.AV_HOST ?? '127.0.0.1',
    port: intEnv('AV_PORT', 3001, 1, 65535),
    allowedOrigins: (process.env.AV_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    clibDir: path.resolve(process.env.AV_CLIB_DIR ?? path.join(repoRoot, 'clib')),
    webDist: path.resolve(process.env.AV_WEB_DIST ?? path.join(repoRoot, 'apps/web/dist')),
    docker: process.env.AV_DOCKER_BIN ?? 'docker',
    sandboxImage: process.env.AV_SANDBOX_IMAGE ?? 'algoviz-sandbox:latest',
    workDir: path.resolve(process.env.AV_WORK_DIR ?? path.join(os.tmpdir(), 'algoviz')),
    maxConcurrentSandboxes: intEnv('AV_MAX_SANDBOXES', 8, 1, 256),
    limits: {
      cpuSeconds: intEnv('AV_CPU_SECONDS', 5, 1, 120),
      wallSeconds: intEnv('AV_WALL_SECONDS', 30, 2, 600),
      memoryMb: intEnv('AV_MEMORY_MB', 256, 32, 4096),
      pids: intEnv('AV_PIDS', 64, 8, 1024),
      outputKb: intEnv('AV_OUTPUT_KB', 256, 4, 16384),
      sourceKb: intEnv('AV_SOURCE_KB', 64, 1, 1024),
      debugIdleSeconds: intEnv('AV_DEBUG_IDLE_SECONDS', 600, 30, 7200),
    },
  };
}
