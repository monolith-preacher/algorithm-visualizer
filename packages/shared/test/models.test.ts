import { describe, expect, it } from 'vitest';

import { buildArrayTrace } from '../src/trace/array-model';
import type { TraceEvent } from '../src/trace/events';
import { buildRecursionTrace } from '../src/trace/recursion-model';
import { analyzeSource } from '../src/trace/source';
import { buildStructureTrace, entryPointer, layoutLinked, type StructureState } from '../src/trace/structure-model';

const source = analyzeSource('void f(int *a, int n) {\n    TRACE_ENTER(n);\n    swap(a, 0, 1);\n}\n');

describe('array model', () => {
  const events: TraceEvent[] = [
    { t: 'array', line: 0, name: 'a', n: 3, values: [3, 1, 2] },
    { t: 'call', line: 2, fn: 'f', depth: 1, vars: { n: 3 } },
    { t: 'compare', line: 2, arr: 'a', i: 0, j: 1, vi: 3, vj: 1, vars: { n: 3 } },
    { t: 'swap', line: 2, arr: 'a', i: 0, j: 1, vars: { n: 3 } },
    { t: 'mark', line: 0, kind: 'sorted', i: 2 },
    { t: 'return', line: 0, fn: 'f', vars: { n: 3 } },
    { t: 'end', line: 0, events: 4, truncated: false, result: { array: [1, 3, 2], sorted: false } },
  ];
  const trace = buildArrayTrace(events, source, 'sort');

  it('applies operations to the array and counts them', () => {
    const swap = trace.steps.find((s) => s.kind === 'swap');
    expect(swap?.values).toEqual([1, 3, 2]);
    expect(swap?.ids).toEqual([1, 0, 2]);
    expect(swap?.counters).toEqual({ comparisons: 1, swaps: 1, writes: 2, auxWrites: 0 });
  });

  it('applies annotations from the next step on', () => {
    const swapIndex = trace.steps.findIndex((s) => s.kind === 'swap');
    expect(trace.steps[swapIndex]?.sorted[2]).toBe(false);
    expect(trace.steps[swapIndex + 1]?.sorted[2]).toBe(true);
  });

  it('checks the replay against the result reported by C', () => {
    expect(trace.consistent).toBe(true);
    const tampered = buildArrayTrace(
      events.map((e) => (e.t === 'end' ? { ...e, result: { array: [9, 9, 9] } } : e)),
      source,
      'sort',
    );
    expect(tampered.consistent).toBe(false);
  });

  it('maps call events to the function signature', () => {
    expect(trace.steps.find((s) => s.kind === 'call')?.line).toBe(1);
    expect(trace.steps.find((s) => s.kind === 'swap')?.line).toBe(3);
  });
});

describe('recursion model', () => {
  it('builds the call tree with return values', () => {
    const events: TraceEvent[] = [
      { t: 'call', line: 2, fn: 'f', depth: 1, vars: { n: 2 } },
      { t: 'call', line: 2, fn: 'f', depth: 2, vars: { n: 1 } },
      { t: 'return', line: 0, fn: 'f', value: 1, vars: { n: 1 } },
      { t: 'return', line: 0, fn: 'f', value: 2, vars: { n: 2 } },
      { t: 'end', line: 0, events: 4, truncated: false, result: { value: 2 } },
    ];
    const trace = buildRecursionTrace(events, source);
    expect(trace.nodes.map((n) => [n.parent, n.value])).toEqual([
      [null, 2],
      [0, 1],
    ]);
    expect(trace.maxDepth).toBe(2);
    // The returning frame stays visible on its return step and is gone afterwards.
    const returns = trace.steps.filter((s) => s.kind === 'return');
    expect(returns[0]?.frames.map((f) => f.returning)).toEqual([false, true]);
    expect(returns[1]?.frames).toHaveLength(1);
  });
});

describe('structure model', () => {
  const node = (id: number, addr: string, value: number, next: string | null) => ({ id, addr, size: 16, line: 1, value, next });
  const empty: StructureState = { self: '0x10', head: null, size: 0, nodes: [] };
  const one: StructureState = { self: '0x10', head: '0xa0', size: 1, nodes: [node(1, '0xa0', 5, null)] };

  it('marks new heap blocks and keeps the operation context', () => {
    const events: TraceEvent[] = [
      { t: 'op', line: 0, index: 0, name: 'insert_front', args: [5], state: empty },
      { t: 'alloc', line: 2, size: 16, failed: false, vars: {}, state: empty },
      { t: 'step', line: 2, vars: { node: '0xa0' }, state: { ...empty, nodes: one.nodes } },
      { t: 'op_end', line: 0, index: 0, name: 'insert_front', ok: true, state: one },
      { t: 'end', line: 0, events: 3, truncated: false, result: { state: one } },
    ];
    const trace = buildStructureTrace(events, source);
    expect(trace.steps.map((s) => s.kind)).toEqual(['op', 'alloc', 'step', 'op_end']);
    expect(trace.steps[2]?.newIds).toEqual([1]);
    expect(trace.steps[3]?.result).toEqual({ ok: true });
    expect(trace.steps.every((s) => s.op?.name === 'insert_front')).toBe(true);
  });

  it('lays out chains, detached nodes and cycles', () => {
    const ring: StructureState = {
      self: '0x10',
      tail: '0xc0',
      size: 3,
      nodes: [node(1, '0xa0', 1, '0xb0'), node(2, '0xb0', 2, '0xc0'), node(3, '0xc0', 3, '0xa0'), node(4, '0xd0', 9, null)],
    };
    const layout = layoutLinked(ring, entryPointer(ring));
    expect(layout.chain.map((n) => n.value)).toEqual([1, 2, 3]);
    expect(layout.circular).toBe(true);
    expect(layout.detached.map((n) => n.id)).toEqual([4]);
  });
});
