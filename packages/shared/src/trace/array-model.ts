import type { TraceEvent } from './events';
import { FrameTracker, eventLine, type StepBase } from './frames';
import type { SourceMap } from './source';

export type CellRole = 'compare' | 'swap' | 'write' | 'read';

export interface ArrayCounters {
  /** Element comparisons (TRACE_COMPARE / TRACE_COMPARE_VALUE). */
  comparisons: number;
  /** Element exchanges. */
  swaps: number;
  /** Element assignments into the input array; a swap counts as two. */
  writes: number;
  /** Element assignments into auxiliary arrays. */
  auxWrites: number;
}

export interface ArrayStep extends StepBase {
  values: number[];
  /** Stable identity of the element at each position (follows swaps). */
  ids: number[];
  aux: (number | null)[] | null;
  roles: Record<number, CellRole>;
  auxRoles: Record<number, CellRole>;
  /** Positions whose final value is known. */
  sorted: boolean[];
  pivot: number | null;
  min: number | null;
  key: number | null;
  range: [number, number] | null;
  /** Value an element is being compared against (key, target, pivot…). */
  reference: { value: number; expr: string } | null;
  counters: ArrayCounters;
  /** Searching: indices already examined, the match, and failure flag. */
  visited: boolean[];
  found: number | null;
  notFound: boolean;
}

export interface ArrayTrace {
  kind: 'array';
  mode: 'sort' | 'search';
  steps: ArrayStep[];
  initial: number[];
  result: Record<string, unknown> | null;
  /** True when replaying the events reproduces the final array reported by C. */
  consistent: boolean;
  truncated: boolean;
  allocatedBytes: number;
}

const emptyCounters = (): ArrayCounters => ({ comparisons: 0, swaps: 0, writes: 0, auxWrites: 0 });

/**
 * Replays a sorting or searching trace. Each operation event becomes one step
 * that shows its effect; annotations (marks, ranges) apply from the next step.
 */
export function buildArrayTrace(
  events: TraceEvent[],
  source: SourceMap,
  mode: 'sort' | 'search',
): ArrayTrace {
  const frames = new FrameTracker();
  let values: number[] = [];
  let ids: number[] = [];
  let aux: (number | null)[] | null = null;
  let sorted: boolean[] = [];
  let visited: boolean[] = [];
  const counters = emptyCounters();
  let found: number | null = null;
  let notFound = false;
  let lastRange: [number, number] | null = null;
  let result: Record<string, unknown> | null = null;
  let truncated = false;
  let allocatedBytes = 0;
  let initial: number[] = [];
  const steps: ArrayStep[] = [];

  const push = (
    kind: string,
    line: number | null,
    roles: Record<number, CellRole> = {},
    auxRoles: Record<number, CellRole> = {},
    reference: ArrayStep['reference'] = null,
  ): void => {
    const range = frames.range();
    if (range) {
      lastRange = range;
    }
    steps.push({
      kind,
      line,
      frames: frames.snapshot(),
      values: [...values],
      ids: [...ids],
      aux: aux ? [...aux] : null,
      roles,
      auxRoles,
      sorted: [...sorted],
      pivot: frames.mark('pivot'),
      min: frames.mark('min'),
      key: frames.mark('key'),
      range: range ?? (mode === 'search' ? lastRange : null),
      reference,
      counters: { ...counters },
      visited: [...visited],
      found,
      notFound,
    });
  };

  const target = (name: string): (number | null)[] => (name === 'a' ? values : (aux ?? []));
  const countWrite = (arr: string, n = 1): void => {
    if (arr === 'a') {
      counters.writes += n;
    } else {
      counters.auxWrites += n;
    }
  };

  let started = false;
  for (const event of events) {
    if (event.t === 'array') {
      if (event.name === 'a') {
        values = event.values ? [...event.values] : new Array<number>(event.n).fill(0);
        initial = [...values];
        ids = values.map((_, i) => i);
        sorted = new Array<boolean>(event.n).fill(false);
        visited = new Array<boolean>(event.n).fill(false);
      } else {
        aux = event.values ? [...event.values] : new Array<number | null>(event.n).fill(null);
      }
      continue;
    }
    if (!started && event.t !== 'end' && event.t !== 'error') {
      started = true;
      push('start', null);
    }
    frames.apply(event);
    const line = eventLine(event, source);

    switch (event.t) {
      case 'mark': {
        if (event.kind === 'sorted') {
          sorted[event.i] = true;
        } else {
          const top = frames.top();
          if (top) {
            top.marks[event.kind] = event.i;
          }
        }
        break;
      }
      case 'range': {
        const top = frames.top();
        if (top) {
          top.range = [event.lo, event.hi];
        }
        break;
      }
      case 'call':
        push('call', line);
        break;
      case 'return': {
        if (mode === 'search' && frames.depth() === 1 && typeof event.value === 'number') {
          if (event.value >= 0) {
            found = event.value;
          } else {
            notFound = true;
          }
        }
        push('return', line);
        break;
      }
      case 'compare': {
        counters.comparisons++;
        const roles = { [event.i]: 'compare', [event.j]: 'compare' } as Record<number, CellRole>;
        if (event.arr === 'a') {
          push('compare', line, roles);
        } else {
          push('compare', line, {}, roles);
        }
        break;
      }
      case 'compare_value': {
        counters.comparisons++;
        if (mode === 'search') {
          visited[event.i] = true;
        }
        push('compare', line, { [event.i]: 'compare' }, {}, { value: event.value, expr: event.expr });
        break;
      }
      case 'swap': {
        const arr = target(event.arr);
        [arr[event.i], arr[event.j]] = [arr[event.j] ?? null, arr[event.i] ?? null];
        if (event.arr === 'a') {
          [ids[event.i], ids[event.j]] = [ids[event.j] ?? event.j, ids[event.i] ?? event.i];
        }
        counters.swaps++;
        countWrite(event.arr, 2);
        push('swap', line, { [event.i]: 'swap', [event.j]: 'swap' });
        break;
      }
      case 'write': {
        target(event.arr)[event.i] = event.value;
        countWrite(event.arr);
        const roles = { [event.i]: 'write' } as Record<number, CellRole>;
        push('write', line, event.arr === 'a' ? roles : {}, event.arr === 'a' ? {} : roles);
        break;
      }
      case 'copy': {
        target(event.arr)[event.i] = event.value;
        countWrite(event.arr);
        const roles: Record<number, CellRole> = {};
        const auxRoles: Record<number, CellRole> = {};
        (event.arr === 'a' ? roles : auxRoles)[event.i] = 'write';
        const srcRoles = event.src === 'a' ? roles : auxRoles;
        if (!(event.src === event.arr && event.j === event.i)) {
          srcRoles[event.j] = 'read';
        }
        push('copy', line, roles, auxRoles);
        break;
      }
      case 'alloc':
        if (!event.failed) {
          allocatedBytes += event.size;
        }
        break;
      case 'end': {
        result = event.result;
        truncated = event.truncated;
        break;
      }
      case 'error':
        throw new Error(event.message);
      default:
        break;
    }
  }

  let consistent = true;
  if (mode === 'sort') {
    const reported = result?.['array'];
    consistent =
      Array.isArray(reported) &&
      reported.length === values.length &&
      reported.every((v, i) => v === values[i]);
    if (consistent) {
      sorted = sorted.map(() => true);
    }
  } else {
    consistent = result?.['index'] === (found ?? -1);
  }
  push('end', null);
  // The last frames have returned; the final step shows an empty stack.
  const last = steps[steps.length - 1];
  if (last) {
    last.frames = [];
  }

  return { kind: 'array', mode, steps, initial, result, consistent, truncated, allocatedBytes };
}
