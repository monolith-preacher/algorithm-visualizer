/**
 * Events emitted by the instrumented C library (clib/src/trace/av_trace.c and
 * clib/driver/avlab.c). One JSON object per line. See docs/trace-format.md.
 */

/** A watched C variable: numbers, booleans, chars ("'A'"), pointers ("0x…") or NULL (null). */
export type VarValue = number | boolean | string | null;
export type Vars = Record<string, VarValue>;

interface EventBase {
  /** Source line of the trace statement (0 for annotations and driver events). */
  line: number;
  /** Watched variables of the innermost frame, captured when the event fired. */
  vars?: Vars;
  /** Structure snapshot (data-structure and Hanoi traces), captured before the line runs. */
  state?: unknown;
}

export interface CallEvent extends EventBase { t: 'call'; fn: string; depth: number }
export interface ReturnEvent extends EventBase { t: 'return'; fn: string; retLine?: number; value?: VarValue }
export interface StepEvent extends EventBase { t: 'step' }
export interface ArrayEvent extends EventBase { t: 'array'; name: string; n: number; values: number[] | null }
export interface CompareEvent extends EventBase { t: 'compare'; arr: string; i: number; j: number; vi: number; vj: number }
export interface CompareValueEvent extends EventBase {
  t: 'compare_value';
  arr: string;
  i: number;
  vi: number;
  value: number;
  /** C expression of the compared value, e.g. "key" or "target". */
  expr: string;
}
export interface SwapEvent extends EventBase { t: 'swap'; arr: string; i: number; j: number }
export interface WriteEvent extends EventBase { t: 'write'; arr: string; i: number; value: number }
export interface CopyEvent extends EventBase { t: 'copy'; arr: string; i: number; src: string; j: number; value: number }
export interface MarkEvent extends EventBase { t: 'mark'; kind: string; i: number }
export interface RangeEvent extends EventBase { t: 'range'; lo: number; hi: number }
export interface MoveEvent extends EventBase { t: 'move'; disk: number; from: string; to: string }
export interface AllocEvent extends EventBase { t: 'alloc'; size: number; failed: boolean }
export interface FreeEvent extends EventBase { t: 'free'; id: number; addr: string }
export interface OpEvent extends EventBase { t: 'op'; index: number; name: string; args: number[] }
export interface OpEndEvent extends EventBase {
  t: 'op_end';
  index: number;
  name: string;
  ok: boolean;
  value?: number;
  values?: number[];
}
export interface EndEvent extends EventBase {
  t: 'end';
  events: number;
  truncated: boolean;
  result: Record<string, unknown>;
}
export interface ErrorEvent extends EventBase { t: 'error'; code: string; message: string }

export type TraceEvent =
  | CallEvent
  | ReturnEvent
  | StepEvent
  | ArrayEvent
  | CompareEvent
  | CompareValueEvent
  | SwapEvent
  | WriteEvent
  | CopyEvent
  | MarkEvent
  | RangeEvent
  | MoveEvent
  | AllocEvent
  | FreeEvent
  | OpEvent
  | OpEndEvent
  | EndEvent
  | ErrorEvent;

export function parseTrace(text: string): TraceEvent[] {
  const events: TraceEvent[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length > 0) {
      events.push(JSON.parse(line) as TraceEvent);
    }
  }
  return events;
}

export function isPointer(value: VarValue | undefined): value is string {
  return typeof value === 'string' && value.startsWith('0x');
}
