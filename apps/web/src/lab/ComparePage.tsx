import { useState } from 'react';

import { ALGORITHMS, arrayInput, findAlgorithm, type AlgorithmInfo, type ArrayStep, type ArrayTrace, type Metric } from '@av/shared';

import { EmptyState, ErrorBox, Spinner } from '../components/ui/misc';
import { cx } from '../lib/cx';
import { formatNs } from '../lib/format';
import { useIsDesktop } from '../lib/useMediaQuery';
import { generate } from './data/generate';
import { ArrayInput } from './inputs/ArrayInput';
import { METRIC_HINT, METRIC_LABEL } from './panels/StatsPanel';
import { PlayerControls } from './player/PlayerControls';
import { usePlayer, usePlayerShortcuts } from './player/usePlayer';
import { useBench, useLabTrace, useSource } from './useLabTrace';
import { Legend, LEGEND } from './visual/colors';
import { SortBars } from './visual/SortBars';

const SORTS = ALGORITHMS.filter((a) => a.module === 'sorting');
const METRICS: Metric[] = ['comparisons', 'swaps', 'writes', 'auxWrites'];

function Side({
  algorithm,
  onSelect,
  trace,
  index,
  animationMs,
  max,
  loading,
  error,
}: {
  algorithm: AlgorithmInfo;
  onSelect: (id: string) => void;
  trace: ArrayTrace | null;
  index: number;
  animationMs: number;
  max: number;
  loading: boolean;
  error: string | null;
}) {
  const steps = trace?.steps ?? [];
  const step = steps[Math.min(index, steps.length - 1)] as ArrayStep | undefined;
  const done = steps.length > 0 && index >= steps.length - 1;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <select className="input" value={algorithm.id} onChange={(e) => onSelect(e.target.value)} aria-label="Algorithm">
          {SORTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span className="font-mono text-[11px] text-faint">worst {algorithm.complexity.worst}</span>
        <span className={cx('ml-auto font-mono text-[11px]', done ? 'text-accent' : 'text-muted')}>
          {loading ? <Spinner /> : done ? `done · ${steps.length} steps` : `${Math.min(index + 1, steps.length)} / ${steps.length}`}
        </span>
      </div>
      <div className="grid-bg relative min-h-0 flex-1 px-3 pt-6 pb-2">
        {error && <ErrorBox>{error}</ErrorBox>}
        {step && <SortBars algorithm={algorithm.id} step={step} animationMs={animationMs} max={max} compact />}
      </div>
    </div>
  );
}

/**
 * Two sorting algorithms on the same input. Counters come from each trace;
 * CPU time from the uninstrumented build, independent of the animation.
 */
export function ComparePage() {
  const desktop = useIsDesktop();
  const [leftId, setLeftId] = useState('insertion-sort');
  const [rightId, setRightId] = useState('quick-sort');
  const left = findAlgorithm(leftId) as AlgorithmInfo;
  const right = findAlgorithm(rightId) as AlgorithmInfo;
  const spec = left.input ?? { min: 2, max: 100, default: 32, valueMin: 1, valueMax: 99 };
  const [values, setValues] = useState(() => generate('random', 32, spec.valueMin ?? 1, spec.valueMax ?? 99));
  const input = arrayInput(values);

  const leftSource = useSource(left);
  const rightSource = useSource(right);
  const leftTrace = useLabTrace(left, leftSource.source, input);
  const rightTrace = useLabTrace(right, rightSource.source, input);
  const leftBench = useBench(left, input);
  const rightBench = useBench(right, input);
  const lt = leftTrace.trace as ArrayTrace | null;
  const rt = rightTrace.trace as ArrayTrace | null;
  const length = Math.max(lt?.steps.length ?? 0, rt?.steps.length ?? 0);
  const player = usePlayer(length, `${lt ? 'l' : ''}${rt ? 'r' : ''}${input}${leftId}${rightId}`, { speed: 15 });
  usePlayerShortcuts(player);
  const max = Math.max(...values, 1);

  const row = (label: string, hint: string, a: string, b: string, better?: 'a' | 'b' | null) => (
    <tr key={label} className="border-b border-line" title={hint}>
      <td className="py-1.5 pr-4 text-muted">{label}</td>
      <td className={cx('py-1.5 pr-4 text-right tabular-nums', better === 'a' ? 'text-accent' : 'text-fg')}>{a}</td>
      <td className={cx('py-1.5 text-right tabular-nums', better === 'b' ? 'text-accent' : 'text-fg')}>{b}</td>
    </tr>
  );
  const finalCounters = (t: ArrayTrace | null) => t?.steps[t.steps.length - 1]?.counters;
  const lc = finalCounters(lt);
  const rc = finalCounters(rt);
  const metricCell = (alg: AlgorithmInfo, value: number | undefined, m: Metric) =>
    (alg.metrics ?? []).includes(m) ? String(value ?? '—') : '—';
  const lowest = (a: number | undefined, b: number | undefined) => (a === undefined || b === undefined || a === b ? null : a < b ? 'a' : 'b');

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <h1 className="font-mono text-sm font-semibold">Compare sorting algorithms</h1>
        <span className="text-xs text-faint">same input, independent traces and counters</span>
      </div>
      <ArrayInput spec={spec} values={values} onChange={setValues} />
      <div className={cx('flex min-h-0 flex-1', desktop ? 'flex-row divide-x divide-line' : 'flex-col divide-y divide-line')}>
        <Side algorithm={left} onSelect={setLeftId} trace={lt} index={player.index} animationMs={player.animationMs} max={max} loading={leftTrace.loading} error={leftTrace.error} />
        <Side algorithm={right} onSelect={setRightId} trace={rt} index={player.index} animationMs={player.animationMs} max={max} loading={rightTrace.loading} error={rightTrace.error} />
      </div>
      <div className="border-t border-line px-3 py-1.5">
        <Legend items={LEGEND} />
      </div>
      <PlayerControls player={player} />
      <div className="max-h-[40%] overflow-auto border-t border-line px-4 py-3">
        {!lc || !rc ? (
          <EmptyState title="waiting for both traces" />
        ) : (
          <table className="w-full max-w-2xl border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-line-strong text-faint">
                <th className="py-1.5 text-left font-normal">totals for n = {values.length}</th>
                <th className="py-1.5 pr-4 text-right font-normal text-cyan">{left.name}</th>
                <th className="py-1.5 text-right font-normal text-cyan">{right.name}</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) =>
                row(
                  METRIC_LABEL[m],
                  `${METRIC_HINT[m]}. "—": the algorithm does not perform this operation.`,
                  metricCell(left, lc[m], m),
                  metricCell(right, rc[m], m),
                  (left.metrics ?? []).includes(m) && (right.metrics ?? []).includes(m) ? lowest(lc[m], rc[m]) : null,
                ),
              )}
              {row('Extra heap memory', 'Bytes allocated with malloc during the sort', `${lt?.allocatedBytes ?? 0} B`, `${rt?.allocatedBytes ?? 0} B`, lowest(lt?.allocatedBytes, rt?.allocatedBytes))}
              {row('Trace steps', 'Visualization steps (not a performance measure)', String(lt?.steps.length ?? '—'), String(rt?.steps.length ?? '—'))}
              {row(
                'CPU time (median)',
                'Uninstrumented -O2 build, median per run over many repetitions; unrelated to animation speed',
                leftBench.result ? formatNs(leftBench.result.medianNs) : leftBench.error ? 'error' : '…',
                rightBench.result ? formatNs(rightBench.result.medianNs) : rightBench.error ? 'error' : '…',
                lowest(leftBench.result?.medianNs, rightBench.result?.medianNs),
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
