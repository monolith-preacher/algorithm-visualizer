import { isPointer, type TraceEvent, type Vars } from './events';
import { FrameTracker, eventLine, type StepBase } from './frames';
import type { SourceMap } from './source';

/** A heap block holding a node, read verbatim from memory by the C driver. */
export interface HeapNode {
  id: number;
  addr: string;
  size: number;
  /** Source line of the malloc call that created the block. */
  line: number;
  value: number;
  next: string | null;
  prev?: string | null;
}

/** Snapshot of a structure as dumped by clib/driver/avlab.c. */
export interface StructureState {
  /** Address of the structure itself (the struct the functions receive a pointer to). */
  self: string;
  capacity?: number;
  items?: number[];
  top?: number | string | null;
  front?: number | string | null;
  rear?: number | string | null;
  count?: number;
  head?: string | null;
  tail?: string | null;
  size?: number;
  nodes?: HeapNode[];
}

export interface OperationInfo {
  index: number;
  name: string;
  args: number[];
}

export interface OperationResult {
  ok: boolean;
  value?: number;
  values?: number[];
}

export interface StructureStep extends StepBase {
  state: StructureState;
  vars: Vars;
  op: OperationInfo | null;
  /** Heap block ids created since the previous step. */
  newIds: number[];
  /** Heap block being released by free() at this line. */
  freeingId: number | null;
  /** malloc returned NULL at this line (injected failure). */
  allocFailed: boolean;
  result: OperationResult | null;
}

export interface StructureTrace {
  kind: 'structure';
  steps: StructureStep[];
  finalState: StructureState | null;
  result: Record<string, unknown> | null;
  truncated: boolean;
}

/**
 * Data-structure traces follow debugger semantics: each step highlights the
 * line about to run and shows the memory state at that moment.
 */
export function buildStructureTrace(events: TraceEvent[], source: SourceMap): StructureTrace {
  const frames = new FrameTracker();
  const steps: StructureStep[] = [];
  let op: OperationInfo | null = null;
  let lastIds = new Set<number>();
  let finalState: StructureState | null = null;
  let result: Record<string, unknown> | null = null;
  let truncated = false;

  for (const event of events) {
    frames.apply(event);
    if (event.t === 'end') {
      result = event.result;
      truncated = event.truncated;
      finalState = (event.result['state'] as StructureState | undefined) ?? null;
      continue;
    }
    if (event.t === 'error') {
      throw new Error(event.message);
    }
    if (!event.state) {
      continue;
    }
    const state = event.state as StructureState;
    if (event.t === 'op') {
      op = { index: event.index, name: event.name, args: event.args };
      lastIds = new Set((state.nodes ?? []).map((n) => n.id));
    }
    const ids = (state.nodes ?? []).map((n) => n.id);
    const newIds = ids.filter((id) => !lastIds.has(id));
    lastIds = new Set(ids);

    const top = frames.top();
    steps.push({
      kind: event.t,
      line: eventLine(event, source),
      frames: event.t === 'op' || event.t === 'op_end' ? [] : frames.snapshot(),
      state,
      vars: top && event.t !== 'op' && event.t !== 'op_end' ? { ...top.vars } : {},
      op,
      newIds,
      freeingId: event.t === 'free' ? event.id : null,
      allocFailed: event.t === 'alloc' && event.failed,
      result:
        event.t === 'op_end'
          ? {
              ok: event.ok,
              ...(event.value !== undefined ? { value: event.value } : {}),
              ...(event.values !== undefined ? { values: event.values } : {}),
            }
          : null,
    });
  }
  if (steps.length === 0 && finalState) {
    // No traced operation (e.g. an empty operation list): show the current state.
    steps.push({
      kind: 'end',
      line: null,
      frames: [],
      state: finalState,
      vars: {},
      op: null,
      newIds: [],
      freeingId: null,
      allocFailed: false,
      result: null,
    });
  }
  return { kind: 'structure', steps, finalState, result, truncated };
}

export interface LinkedLayout {
  /** Nodes reachable from the entry pointer, in link order. */
  chain: HeapNode[];
  /** Live blocks not reachable from the entry pointer (e.g. just allocated). */
  detached: HeapNode[];
  /** The chain closes back on its first node (circular list). */
  circular: boolean;
}

/** Orders heap nodes by following next pointers from the structure's entry point. */
export function layoutLinked(state: StructureState, entry: string | null | undefined): LinkedLayout {
  const nodes = state.nodes ?? [];
  const byAddr = new Map(nodes.map((n) => [n.addr, n]));
  const chain: HeapNode[] = [];
  const seen = new Set<string>();
  let cursor = entry ?? null;
  let circular = false;
  while (cursor && byAddr.has(cursor)) {
    if (seen.has(cursor)) {
      circular = cursor === chain[0]?.addr;
      break;
    }
    seen.add(cursor);
    const node = byAddr.get(cursor) as HeapNode;
    chain.push(node);
    cursor = node.next;
  }
  const detached = nodes.filter((n) => !seen.has(n.addr));
  return { chain, detached, circular };
}

/** Entry pointer for a structure: head of a list, top of a stack, front of a queue. */
export function entryPointer(state: StructureState): string | null {
  if (state.head !== undefined) {
    return state.head;
  }
  if (state.tail !== undefined) {
    // Circular list addressed by tail: the head is tail->next.
    const tail = state.nodes?.find((n) => n.addr === state.tail);
    return tail?.next ?? null;
  }
  if (isPointer(state.top ?? null)) {
    return state.top as string;
  }
  if (isPointer(state.front ?? null)) {
    return state.front as string;
  }
  return null;
}
