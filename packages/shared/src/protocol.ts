/**
 * Contracts between the web client and the server: REST payloads for the
 * Algorithm Lab and WebSocket messages for the C Playground.
 */
import type { TraceEvent } from './trace/events';

/* ------------------------------------------------------------------ REST */

export interface SandboxStatus {
  available: boolean;
  /** Human-readable reason when the sandbox cannot be used. */
  reason?: string;
  image: string;
}

export interface HealthResponse {
  ok: boolean;
  lab: { available: boolean; reason?: string };
  sandbox: SandboxStatus;
  limits: ExecutionLimits;
}

export interface ExecutionLimits {
  cpuSeconds: number;
  wallSeconds: number;
  memoryMb: number;
  pids: number;
  outputKb: number;
  sourceKb: number;
  debugIdleSeconds: number;
}

export interface SourceResponse {
  id: string;
  source: string;
  header: string;
}

export interface TraceRequest {
  algorithm: string;
  /** Driver input, see clib/driver/avlab.c. */
  input: string;
  /** Structures: first operation index to trace. */
  traceFrom?: number;
}

export interface TraceResponse {
  events: TraceEvent[];
}

export interface BenchRequest {
  algorithm: string;
  input: string;
}

/** Processing time of the uninstrumented build (-O2, no TRACE_* code). */
export interface BenchResponse {
  runs: number;
  batch: number;
  medianNs: number;
  minNs: number;
  meanNs: number;
  n: number;
}

export interface ApiError {
  error: string;
  code?: string;
}

export function arrayInput(values: number[], target?: number): string {
  const parts = [String(values.length), values.join(' ')];
  if (target !== undefined) {
    parts.push(String(target));
  }
  return `${parts.join('\n')}\n`;
}

export interface StructureOperation {
  name: string;
  args: number[];
}

export function operationsInput(ops: StructureOperation[]): string {
  return ops.map((op) => [op.name, ...op.args].join(' ')).join('\n') + '\n';
}

/* -------------------------------------------------------- Playground WS */

export interface CompileOptions {
  /** Build with -fsanitize=address,undefined (Run mode only). */
  sanitizers: boolean;
}

export interface Diagnostic {
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'note';
  message: string;
}

export type DebugCommand = 'step_into' | 'step_over' | 'step_out' | 'continue' | 'pause';

export type ClientMessage =
  | { type: 'compile'; code: string; options: CompileOptions }
  | { type: 'run'; code: string; options: CompileOptions }
  | { type: 'stdin'; data: string }
  | { type: 'stdin_eof' }
  | { type: 'stop' }
  | { type: 'debug_start'; code: string; stdin: string; breakpoints: number[] }
  | { type: 'debug_command'; command: DebugCommand }
  | { type: 'debug_breakpoints'; lines: number[] }
  | { type: 'debug_evaluate'; id: number; expression: string; frame: number }
  | { type: 'debug_stop' };

export type SessionPhase = 'idle' | 'compiling' | 'running' | 'debugging';

export interface ExitInfo {
  /** exited | signal | cpu_limit | wall_timeout | file_size_limit | output_limit | killed */
  reason: string;
  exitCode: number | null;
  signal: string | null;
  wallMs: number | null;
  cpuMs: number | null;
  maxRssKb: number | null;
  message: string;
}

export interface CompileResult {
  ok: boolean;
  mode: 'run' | 'debug';
  diagnostics: Diagnostic[];
  /** Raw compiler output (stderr). */
  output: string;
  durationMs: number;
  command: string;
}

export type ServerMessage =
  | { type: 'hello'; sandbox: SandboxStatus; limits: ExecutionLimits }
  | { type: 'phase'; phase: SessionPhase }
  | { type: 'compile_result'; result: CompileResult }
  | { type: 'output'; stream: 'stdout' | 'stderr'; data: string }
  | { type: 'exit'; info: ExitInfo }
  | { type: 'debug_paused'; snapshot: DebugSnapshot }
  | { type: 'debug_running' }
  | { type: 'debug_breakpoints'; lines: number[] }
  | { type: 'debug_eval'; id: number; expression: string; value?: string; valueType?: string; error?: string }
  | { type: 'debug_ended'; info: ExitInfo }
  | { type: 'error'; message: string };

/* ---------------------------------------------------------- Debugger model */

export interface DebugValue {
  name: string;
  /** C expression that evaluates to this value (used to expand/evaluate). */
  expression: string;
  type: string;
  /** Value as printed by GDB. */
  value: string;
  kind: 'scalar' | 'pointer' | 'array' | 'struct' | 'function' | 'unknown';
  /** Address of the object (&expression), when it has one. */
  address: string | null;
  /** Pointer value, when kind is 'pointer' (null for NULL). */
  pointsTo?: string | null;
  sizeBytes?: number;
  children?: DebugValue[];
  /** More children exist than were fetched. */
  truncated?: boolean;
  error?: string;
}

export interface DebugFrame {
  level: number;
  func: string;
  line: number | null;
  file: string | null;
  address: string;
  /** Frame is in the user's main.c (has source). */
  user: boolean;
  args: DebugValue[];
  locals: DebugValue[];
}

/** A heap block recorded by the allocation tracker (sandbox/avrt.c). */
export interface HeapBlock {
  address: string;
  size: number;
  state: 'live' | 'freed';
  /** Typed view of the block when a pointer of known type refers to it. */
  view?: DebugValue;
}

export interface MemoryRegion {
  name: 'stack' | 'heap' | 'data' | 'text' | 'other';
  start: string;
  end: string;
}

export interface DebugSnapshot {
  reason: string;
  /** Present when the program stopped on a signal (e.g. SIGSEGV). */
  signal?: { name: string; meaning: string };
  line: number | null;
  func: string | null;
  frames: DebugFrame[];
  /** Global and static variables of main.c. */
  globals: DebugValue[];
  heap: HeapBlock[];
  heapTracking: { available: boolean; overflow: boolean };
  regions: MemoryRegion[];
  /** Value returned by the function left with Step Out. */
  returnValue?: { func: string; value: string };
}
