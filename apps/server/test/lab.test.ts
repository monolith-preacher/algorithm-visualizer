import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ALGORITHMS,
  analyzeSource,
  arrayInput,
  buildTrace,
  findAlgorithm,
  layoutLinked,
  entryPointer,
  operationsInput,
  type ArrayTrace,
  type RecursionTrace,
  type StructureTrace,
  type StructureOperation,
} from '@av/shared';

import { loadConfig } from '../src/config';
import { LabRunner } from '../src/lab/runner';

const config = loadConfig();
const runner = new LabRunner(config);

async function trace(id: string, input: string, traceFrom?: number) {
  const algorithm = findAlgorithm(id);
  if (!algorithm) {
    throw new Error(id);
  }
  const { source } = await runner.source(id);
  const map = analyzeSource(source);
  const events = await runner.trace(id, input, traceFrom);
  return { trace: buildTrace(algorithm, events, map), map };
}

const sortIds = ALGORITHMS.filter((a) => a.module === 'sorting').map((a) => a.id);

function inputs(): number[][] {
  let seed = 12345;
  const rand = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  const cases: number[][] = [[5], [2, 1], [1, 2], [3, 3, 3, 3], [5, 1, 4, 1, 5, 9, 2, 6, 5, 3]];
  cases.push(Array.from({ length: 30 }, (_, i) => i + 1));
  cases.push(Array.from({ length: 30 }, (_, i) => 30 - i));
  for (let k = 0; k < 6; k++) {
    cases.push(Array.from({ length: 5 + rand(60) }, () => rand(100)));
  }
  return cases;
}

describe('C sources and instrumentation', () => {
  it('keeps every trace statement on a single line', () => {
    for (const algorithm of ALGORITHMS) {
      const file = fs.readFileSync(path.join(config.clibDir, 'src', algorithm.source), 'utf8');
      const map = analyzeSource(file);
      file.split('\n').forEach((line, i) => {
        if (line.includes('TRACE_')) {
          expect(map.instrumentation.has(i + 1), `${algorithm.source}:${i + 1}`).toBe(true);
        }
      });
      expect(map.cleanText).not.toContain('TRACE_');
      expect(map.cleanText).not.toContain('av_trace.h');
      // Hiding instrumentation must never leave an empty block behind.
      expect(map.cleanText, algorithm.source).not.toMatch(/\{\s*\n\s*\}/);
    }
  });
});

describe('sorting traces replay to the result computed in C', () => {
  for (const id of sortIds) {
    it(id, async () => {
      for (const values of inputs()) {
        const { trace: t, map } = await trace(id, arrayInput(values));
        const sorted = [...values].sort((a, b) => a - b);
        const result = t as ArrayTrace;
        expect(result.consistent, `${id} ${values.join(',')}`).toBe(true);
        expect(result.result?.['sorted']).toBe(true);
        const last = result.steps[result.steps.length - 1];
        expect(last?.values).toEqual(sorted);
        expect(last?.sorted.every(Boolean)).toBe(true);
        // Identity tracking: every element id appears exactly once.
        expect([...(last?.ids ?? [])].sort((a, b) => a - b)).toEqual(values.map((_, i) => i));
        for (const step of result.steps) {
          if (step.line !== null) {
            expect(map.instrumentation.has(step.line)).toBe(false);
          }
        }
      }
    });
  }

  it('counts operations coherently with known closed forms', async () => {
    const n = 20;
    const reversed = Array.from({ length: n }, (_, i) => n - i);
    const ascending = Array.from({ length: n }, (_, i) => i);
    const final = async (id: string, values: number[]) => {
      const t = (await trace(id, arrayInput(values))).trace as ArrayTrace;
      return t.steps[t.steps.length - 1]?.counters;
    };
    const all = n * (n - 1) / 2;
    expect(await final('bubble-sort', reversed)).toMatchObject({ comparisons: all, swaps: all, writes: 2 * all });
    expect(await final('bubble-sort', ascending)).toMatchObject({ comparisons: n - 1, swaps: 0 });
    expect((await final('selection-sort', ascending))?.comparisons).toBe(all);
    expect((await final('selection-sort', ascending))?.swaps).toBe(0);
    expect(await final('insertion-sort', ascending)).toMatchObject({ comparisons: n - 1, swaps: 0, writes: n - 1 });
    expect((await final('quick-sort', ascending))?.comparisons).toBe(all);
    const merge = await final('merge-sort', reversed);
    expect(merge?.swaps).toBe(0);
    expect(merge?.writes).toBe(merge?.auxWrites);
  });
});

describe('searching traces', () => {
  it('finds, misses and respects the binary search precondition', async () => {
    const values = [2, 4, 4, 8, 15, 16, 23, 42];
    for (const id of ['linear-search', 'binary-search']) {
      for (const target of [2, 4, 23, 42, 1, 5, 99]) {
        const t = (await trace(id, arrayInput(values, target))).trace as ArrayTrace;
        const last = t.steps[t.steps.length - 1];
        expect(t.consistent).toBe(true);
        if (values.includes(target)) {
          expect(values[last?.found ?? -1]).toBe(target);
        } else {
          expect(last?.notFound).toBe(true);
        }
        if (id === 'binary-search') {
          expect(last?.counters.comparisons).toBeLessThanOrEqual(2 * (Math.floor(Math.log2(values.length)) + 1));
        }
      }
    }
    await expect(runner.trace('binary-search', arrayInput([3, 1, 2], 1))).rejects.toThrow(/sorted/);
  });
});

describe('recursion traces', () => {
  it('builds the call tree of factorial and fibonacci', async () => {
    const fact = (await trace('factorial', '6\n')).trace as RecursionTrace;
    expect(fact.nodes).toHaveLength(6);
    expect(fact.nodes[0]?.value).toBe(720);
    expect(fact.maxDepth).toBe(6);
    const fib = (await trace('fibonacci', '7\n')).trace as RecursionTrace;
    expect(fib.nodes).toHaveLength(2 * 21 - 1);
    expect(fib.nodes[0]?.value).toBe(13);
    expect(fib.nodes.every((n) => n.returnStep !== null && n.returnStep > n.callStep)).toBe(true);
  });

  it('moves the Hanoi disks legally to peg C', async () => {
    const t = (await trace('hanoi', '5\n')).trace as RecursionTrace;
    const moves = t.steps.filter((s) => s.kind === 'move');
    expect(moves).toHaveLength(31);
    for (const step of moves) {
      for (const peg of step.pegs ?? []) {
        expect([...peg].sort((a, b) => b - a)).toEqual(peg);
      }
    }
    expect(t.steps[t.steps.length - 1]?.pegs).toEqual([[], [], [5, 4, 3, 2, 1]]);
    expect(t.result?.['legal']).toBe(true);
  });
});

describe('data structure traces', () => {
  const run = async (id: string, ops: StructureOperation[]) => {
    const t = (await trace(id, operationsInput(ops), ops.length - 1)).trace as StructureTrace;
    return t;
  };

  it('replays stack operations deterministically (stable heap addresses)', async () => {
    const ops = [{ name: 'push', args: [1] }, { name: 'push', args: [2] }, { name: 'push', args: [3] }];
    const a = await run('linked-stack', ops);
    const b = await run('linked-stack', [...ops]);
    expect(a.finalState?.nodes?.map((n) => n.addr)).toEqual(b.finalState?.nodes?.map((n) => n.addr));
    const popped = await run('linked-stack', [...ops, { name: 'pop', args: [] }]);
    const end = popped.steps[popped.steps.length - 1];
    expect(end?.result).toEqual({ ok: true, value: 3 });
    expect(popped.steps.some((s) => s.kind === 'free')).toBe(true);
    const chain = layoutLinked(popped.finalState!, entryPointer(popped.finalState!)).chain.map((n) => n.value);
    expect(chain).toEqual([2, 1]);
  });

  it('reports overflow, underflow and injected allocation failures', async () => {
    const full = Array.from({ length: 9 }, (_, i) => ({ name: 'push', args: [i] }));
    const overflow = await run('array-stack', full);
    expect(overflow.steps[overflow.steps.length - 1]?.result?.ok).toBe(false);
    const underflow = await run('array-queue', [{ name: 'dequeue', args: [] }]);
    expect(underflow.steps[underflow.steps.length - 1]?.result?.ok).toBe(false);
    const failed = await run('linked-queue', [
      { name: 'enqueue', args: [1] },
      { name: 'fail_next_alloc', args: [] },
      { name: 'enqueue', args: [2] },
    ]);
    expect(failed.steps.some((s) => s.allocFailed)).toBe(true);
    expect(failed.finalState?.size).toBe(1);
  });

  it('wraps the circular queue indices', async () => {
    const ops: StructureOperation[] = [];
    for (let i = 0; i < 8; i++) ops.push({ name: 'enqueue', args: [i] });
    for (let i = 0; i < 3; i++) ops.push({ name: 'dequeue', args: [] });
    ops.push({ name: 'enqueue', args: [100] });
    const t = await run('circular-queue', ops);
    expect(t.finalState).toMatchObject({ front: 3, rear: 1, count: 6 });
    expect(t.finalState?.items?.[0]).toBe(100);
  });

  it('keeps linked lists consistent', async () => {
    for (const id of ['singly-linked-list', 'doubly-linked-list', 'circular-linked-list']) {
      const t = await run(id, [
        { name: 'insert_back', args: [1] },
        { name: 'insert_back', args: [3] },
        { name: 'insert_front', args: [0] },
        { name: 'insert_at', args: [2, 2] },
        { name: 'remove', args: [0] },
        { name: 'search', args: [3] },
      ]);
      const state = t.finalState!;
      const layout = layoutLinked(state, entryPointer(state));
      expect(layout.chain.map((n) => n.value), id).toEqual([1, 2, 3]);
      expect(layout.detached).toHaveLength(0);
      expect(layout.circular).toBe(id === 'circular-linked-list');
      expect(t.steps[t.steps.length - 1]?.result).toEqual({ ok: true, value: 2 });
      if (id === 'doubly-linked-list') {
        const nodes = layout.chain;
        nodes.forEach((n, i) => expect(n.prev).toBe(i === 0 ? null : nodes[i - 1]?.addr));
      }
    }
  });
});

describe('benchmarks of the uninstrumented build', () => {
  it('measures processing time separately from the trace', async () => {
    const result = await runner.bench('merge-sort', arrayInput([5, 3, 1, 4, 2, 8, 7, 6]));
    expect(result.runs).toBeGreaterThan(0);
    expect(result.medianNs).toBeGreaterThan(0);
    await expect(runner.bench('factorial', '5\n')).rejects.toThrow();
  });
});
