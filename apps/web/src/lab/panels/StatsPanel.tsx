import type { AlgorithmInfo, ArrayCounters, Metric, RecursionTrace } from '@av/shared';

import { PanelHeader, Spinner } from '../../components/ui/misc';
import { formatNs } from '../../lib/format';
import type { BenchState } from '../useLabTrace';

export const METRIC_LABEL: Record<Metric, string> = {
  comparisons: 'Comparisons',
  swaps: 'Swaps',
  writes: 'Array writes',
  auxWrites: 'Aux writes',
};

export const METRIC_HINT: Record<Metric, string> = {
  comparisons: 'Element comparisons executed by the C code',
  swaps: 'Element exchanges',
  writes: 'Assignments into the input array (a swap counts as two)',
  auxWrites: 'Assignments into the auxiliary buffer',
};

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-0.5 font-mono text-xs" title={hint}>
      <span className="text-muted">{label}</span>
      <span className={tone ?? 'text-fg tabular-nums'}>{value}</span>
    </div>
  );
}

/** Operation counters at the current step and measured CPU time of the uninstrumented build. */
export function StatsPanel({
  algorithm,
  counters,
  total,
  bench,
  allocatedBytes,
  step,
  steps,
}: {
  algorithm: AlgorithmInfo;
  counters: ArrayCounters | undefined;
  total: ArrayCounters | undefined;
  bench: BenchState;
  allocatedBytes: number;
  step: number;
  steps: number;
}) {
  const metrics = algorithm.metrics ?? [];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader title="Statistics" />
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {metrics.map((m) => (
          <Stat
            key={m}
            label={METRIC_LABEL[m]}
            hint={METRIC_HINT[m]}
            value={`${counters?.[m] ?? 0}${total ? ` / ${total[m]}` : ''}`}
          />
        ))}
        {allocatedBytes > 0 && <Stat label="Heap allocated" value={`${allocatedBytes} B`} hint="Bytes requested with malloc" />}
        <Stat label="Trace step" value={`${step + 1} / ${steps}`} />
        <div className="mx-3 my-1.5 border-t border-line" />
        <div className="px-3 pb-0.5 font-mono text-[10px] tracking-wider text-faint uppercase">CPU time · plain -O2 build</div>
        {bench.loading && (
          <div className="flex items-center gap-2 px-3 py-0.5 font-mono text-xs text-faint">
            <Spinner /> measuring
          </div>
        )}
        {bench.error && <div className="px-3 font-mono text-xs text-st-swap">{bench.error}</div>}
        {bench.result && (
          <>
            <Stat label="Median per run" value={formatNs(bench.result.medianNs)} tone="text-accent tabular-nums" hint="Processing time without instrumentation or animation" />
            <Stat label="Fastest run" value={formatNs(bench.result.minNs)} />
            <Stat label="Runs measured" value={bench.result.runs.toLocaleString('en-US')} />
          </>
        )}
      </div>
    </div>
  );
}

/** Progress of a recursive computation at the current step. */
export function RecursionStatsPanel({ trace, index }: { trace: RecursionTrace; index: number }) {
  const step = trace.steps[index];
  let calls = 0;
  let returned = 0;
  let deepest = 0;
  for (const node of trace.nodes) {
    if (node.callStep <= index) {
      calls++;
      deepest = Math.max(deepest, node.depth + 1);
      if (node.returnStep !== null && node.returnStep <= index) {
        returned++;
      }
    }
  }
  const root = trace.nodes[0];
  const done = root?.returnStep !== null && root?.returnStep !== undefined && root.returnStep <= index;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader title="Statistics" />
      <div className="min-h-0 flex-1 overflow-auto py-1">
        <Stat label="Calls made" value={`${calls} / ${trace.nodes.length}`} hint="Invocations started so far / in total" />
        <Stat label="Calls returned" value={String(returned)} />
        <Stat label="Stack depth" value={`${step?.frames.length ?? 0}`} hint="Frames currently on the call stack" />
        <Stat label="Max depth so far" value={`${deepest} / ${trace.maxDepth}`} />
        {step?.moves !== undefined && <Stat label="Disk moves" value={`${step.moves} / ${trace.result?.['moves'] ?? '—'}`} />}
        {done && trace.result?.['value'] !== undefined && (
          <Stat label="Result" value={String(trace.result['value'])} tone="text-accent tabular-nums" />
        )}
        <Stat label="Trace step" value={`${index + 1} / ${trace.steps.length}`} />
      </div>
    </div>
  );
}
