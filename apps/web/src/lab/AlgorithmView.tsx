import { useMemo, useState } from 'react';

import {
  arrayInput,
  operationsInput,
  type AlgorithmInfo,
  type ArrayStep,
  type ArrayTrace,
  type Frame,
  type LabTrace,
  type RecursionStep,
  type StructureStep,
  type Vars,
} from '@av/shared';

import { CodeView } from '../components/code/CodeView';
import { Button } from '../components/ui/Button';
import { Group, Handle, Panel } from '../components/ui/Resizable';
import { Badge, EmptyState, ErrorBox, Spinner, Tabs } from '../components/ui/misc';
import { useIsDesktop } from '../lib/useMediaQuery';
import { generate } from './data/generate';
import { InfoPanel } from './InfoPanel';
import { ArrayInput } from './inputs/ArrayInput';
import { OperationsPanel, type HistoryEntry } from './inputs/OperationsPanel';
import { CallStackPanel, VariablesPanel } from './panels/FramePanels';
import { RecursionStatsPanel, StatsPanel } from './panels/StatsPanel';
import { PlayerControls } from './player/PlayerControls';
import { usePlayer, usePlayerShortcuts, type Player } from './player/usePlayer';
import { useBench, useLabTrace, useSource } from './useLabTrace';
import { ArrayQueueView, ArrayStackView, CircularQueueView } from './visual/ArrayStructures';
import { CallTree } from './visual/CallTree';
import { Legend, LEGEND } from './visual/colors';
import { Hanoi } from './visual/Hanoi';
import { LinkedNodes } from './visual/LinkedNodes';
import { SearchArray } from './visual/SearchArray';
import { SortBars } from './visual/SortBars';

const STRUCTURE_KINDS = new Set(['array-stack', 'linked-stack', 'array-queue', 'circular-queue', 'linked-queue', 'linked-list']);

function defaultOperations(algorithm: AlgorithmInfo): HistoryEntry[] {
  const first = algorithm.operations?.[0]?.name;
  if (!first) {
    return [];
  }
  return [12, 7, 31].map((v) => ({ op: { name: first === 'insert_front' ? 'insert_back' : first, args: [v] } }));
}

function initialValues(algorithm: AlgorithmInfo): number[] {
  const spec = algorithm.input;
  if (!spec || (algorithm.module !== 'sorting' && algorithm.module !== 'searching')) {
    return [];
  }
  const values = generate('random', spec.default, spec.valueMin ?? 1, spec.valueMax ?? 99);
  return algorithm.id === 'binary-search' ? values.sort((a, b) => a - b) : values;
}

/** Variables shown in the Variables panel: the innermost frame's watched locals. */
function topVars(step: LabTrace['steps'][number] | undefined): { vars: Vars | undefined; frame: Frame | undefined } {
  const frame = step?.frames[step.frames.length - 1];
  return { vars: step && 'state' in step ? step.vars : frame?.vars, frame };
}

export function AlgorithmView({ algorithm }: { algorithm: AlgorithmInfo }) {
  const desktop = useIsDesktop();
  const [tab, setTab] = useState<'visualize' | 'info'>('visualize');
  const { source, error: sourceError } = useSource(algorithm);
  const structure = STRUCTURE_KINDS.has(algorithm.visual);
  const spec = algorithm.input;

  const [values, setValues] = useState<number[]>(() => initialValues(algorithm));
  const [target, setTarget] = useState<number>(() => values[Math.floor(values.length / 3)] ?? 0);
  const [n, setN] = useState(spec?.default ?? 4);
  const [history, setHistory] = useState<HistoryEntry[]>(() => defaultOperations(algorithm));

  const opsKey = JSON.stringify(history.map((h) => h.op));
  const input = useMemo(() => {
    if (algorithm.module === 'sorting') return arrayInput(values);
    if (algorithm.module === 'searching') return arrayInput(values, target);
    if (algorithm.module === 'recursion') return `${n}\n`;
    return operationsInput(JSON.parse(opsKey) as HistoryEntry['op'][]);
  }, [algorithm.module, values, target, n, opsKey]);
  const traceFrom = structure ? Math.max(0, history.length - 1) : undefined;

  const { trace, loading, error } = useLabTrace(algorithm, source, input, traceFrom);
  const steps = trace?.steps ?? [];
  // Data structures animate each new operation as soon as its trace arrives.
  const player = usePlayer(steps.length, trace, { autoplay: structure });
  usePlayerShortcuts(player, tab === 'visualize');
  const bench = useBench(algorithm, input);

  // Record the result of the operation just traced in the history.
  const [recorded, setRecorded] = useState<LabTrace | null>(null);
  if (trace !== recorded) {
    setRecorded(trace);
    const end = trace?.kind === 'structure' ? [...trace.steps].reverse().find((s) => s.result) : undefined;
    if (end?.result && end.op) {
      const index = end.op.index;
      const result = end.result;
      setHistory((h) => h.map((e, i) => (i === index ? { ...e, result } : e)));
    }
  }

  const step = steps[player.index];
  const prev = player.index > 0 ? steps[player.index - 1] : undefined;
  const current = topVars(step);
  const previous = topVars(prev);
  const previousVars = previous.frame?.id === current.frame?.id ? previous.vars : undefined;

  const runOperation = (op: HistoryEntry['op'], failAlloc: boolean) => {
    setHistory((h) => [...h, ...(failAlloc ? [{ op: { name: 'fail_next_alloc', args: [] } }] : []), { op }]);
  };
  const undo = () =>
    setHistory((h) => {
      const next = h.slice(0, -1);
      return next[next.length - 1]?.op.name === 'fail_next_alloc' ? next.slice(0, -1) : next;
    });

  const inputBar =
    algorithm.module === 'sorting' || algorithm.module === 'searching' ? (
      spec && (
        <ArrayInput
          spec={spec}
          values={values}
          onChange={setValues}
          sorted={algorithm.id === 'binary-search'}
          {...(algorithm.module === 'searching' ? { target, onTargetChange: setTarget } : {})}
        />
      )
    ) : algorithm.module === 'recursion' && spec ? (
      <div className="flex items-center gap-3 border-b border-line px-3 py-2">
        <label className="flex items-center gap-2 font-mono text-[11px] text-faint">
          {algorithm.id === 'hanoi' ? 'disks' : 'n'}
          <input
            type="range"
            min={spec.min}
            max={spec.max}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="h-1 w-36 cursor-pointer accent-cyan"
          />
          <span className="w-6 text-muted tabular-nums">{n}</span>
        </label>
        {trace?.kind === 'recursion' && (
          <span className="ml-auto font-mono text-[11px] text-faint">
            calls <span className="text-fg">{trace.nodes.length}</span> · max depth <span className="text-fg">{trace.maxDepth}</span>
            {trace.result?.['value'] !== undefined && (
              <>
                {' '}
                · result <span className="text-accent">{String(trace.result['value'])}</span>
              </>
            )}
          </span>
        )}
      </div>
    ) : null;

  const precondition = error?.includes('sorted') ?? false;
  const canvas = (
    <div className="relative flex h-full min-h-0 flex-col">
      {inputBar}
      <div className="grid-bg relative min-h-0 flex-1 overflow-hidden">
        {step && trace && (
          <div className={`h-full w-full ${algorithm.module === 'sorting' ? 'px-4 pt-6 pb-2' : ''}`}>
            <Visual algorithm={algorithm} trace={trace} step={step} prev={prev} player={player} target={target} />
          </div>
        )}
        {(loading || (!trace && !error && !sourceError)) && (
          <div className="absolute top-3 right-3 flex items-center gap-2 font-mono text-[11px] text-faint">
            <Spinner /> running C
          </div>
        )}
        {(error || sourceError) && (
          <div className="absolute inset-x-4 top-4 flex flex-col items-start gap-2">
            <ErrorBox>{error ?? sourceError}</ErrorBox>
            {precondition && (
              <Button size="sm" onClick={() => setValues([...values].sort((a, b) => a - b))}>
                Sort input
              </Button>
            )}
          </div>
        )}
        {trace?.kind === 'array' && !(trace as ArrayTrace).consistent && (
          <div className="absolute bottom-2 left-3">
            <Badge tone="danger">trace replay differs from the C result</Badge>
          </div>
        )}
      </div>
      {(algorithm.module === 'sorting' || algorithm.module === 'searching') && (
        <div className="border-t border-line px-3 py-1.5">
          <Legend items={algorithm.module === 'sorting' ? LEGEND : LEGEND.filter((l) => ['compare', 'final position'].includes(l.label))} />
        </div>
      )}
      <PlayerControls player={player} operation={step?.kind} />
    </div>
  );

  const total = trace?.kind === 'array' ? trace.steps[trace.steps.length - 1]?.counters : undefined;
  const panels = (
    <div className={desktop ? 'grid h-full grid-cols-3 divide-x divide-line' : 'flex flex-col divide-y divide-line'}>
      {structure ? (
        <OperationsPanel
          algorithm={algorithm}
          history={history}
          size={(step as StructureStep | undefined)?.state.size ?? (step as StructureStep | undefined)?.state.count ?? 0}
          busy={loading}
          onRun={runOperation}
          onUndo={undo}
          onClear={() => setHistory([])}
        />
      ) : (
        <VariablesPanel vars={current.vars} previous={previousVars} />
      )}
      {structure ? <VariablesPanel vars={current.vars} previous={previousVars} /> : <CallStackPanel frames={step?.frames ?? []} map={source?.map ?? null} />}
      {trace?.kind === 'array' ? (
        <StatsPanel
          algorithm={algorithm}
          counters={(step as ArrayStep | undefined)?.counters}
          total={total}
          bench={bench}
          allocatedBytes={trace.allocatedBytes}
          step={player.index}
          steps={steps.length}
        />
      ) : trace?.kind === 'recursion' ? (
        <RecursionStatsPanel trace={trace} index={player.index} />
      ) : (
        <CallStackPanel frames={step?.frames ?? []} map={source?.map ?? null} />
      )}
    </div>
  );

  const code = source ? (
    <CodeView
      fileName={algorithm.source.split('/')[1] ?? algorithm.source}
      headerName={algorithm.header.split('/')[1] ?? algorithm.header}
      map={source.map}
      header={source.header}
      line={step?.line ?? null}
    />
  ) : (
    <EmptyState title={sourceError ? 'source unavailable' : 'loading source'} />
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-sm font-semibold">{algorithm.name}</h1>
          <span className="hidden text-xs text-faint md:inline">{algorithm.summary}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {algorithm.complexity.worst && <Badge>worst {algorithm.complexity.worst}</Badge>}
          <Tabs
            className="h-7"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'visualize', label: 'Visualize' },
              { id: 'info', label: 'Info' },
            ]}
          />
        </div>
      </div>
      {tab === 'info' ? (
        <InfoPanel algorithm={algorithm} />
      ) : desktop ? (
        <Group orientation="horizontal" className="min-h-0 flex-1">
          <Panel defaultSize="62%" minSize="35%">
            <Group orientation="vertical">
              <Panel defaultSize="68%" minSize="35%">
                {canvas}
              </Panel>
              <Handle direction="vertical" />
              <Panel defaultSize="32%" minSize="12%">
                {panels}
              </Panel>
            </Group>
          </Panel>
          <Handle />
          <Panel defaultSize="38%" minSize="20%">
            {code}
          </Panel>
        </Group>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex h-[62vh] flex-col">{canvas}</div>
          <div className="h-[55vh] border-t border-line">{code}</div>
          <div className="border-t border-line">{panels}</div>
        </div>
      )}
    </div>
  );
}

function Visual({
  algorithm,
  trace,
  step,
  prev,
  player,
  target,
}: {
  algorithm: AlgorithmInfo;
  trace: LabTrace;
  step: LabTrace['steps'][number];
  prev: LabTrace['steps'][number] | undefined;
  player: Player;
  target: number;
}) {
  const ms = player.animationMs;
  switch (algorithm.visual) {
    case 'sort': {
      const t = trace as ArrayTrace;
      return <SortBars algorithm={algorithm.id} step={step as ArrayStep} animationMs={ms} max={Math.max(...t.initial, 1)} />;
    }
    case 'search':
      return <SearchArray algorithm={algorithm.id} step={step as ArrayStep} target={target} animationMs={ms} />;
    case 'call-tree':
      return trace.kind === 'recursion' ? <CallTree trace={trace} index={player.index} /> : null;
    case 'hanoi': {
      const disks = (step as RecursionStep).pegs?.reduce((sum, peg) => sum + peg.length, 0) ?? 0;
      return <Hanoi step={step as RecursionStep} disks={disks} animationMs={ms} />;
    }
    case 'array-stack':
      return <ArrayStackView step={step as StructureStep} prev={prev as StructureStep | undefined} />;
    case 'array-queue':
      return <ArrayQueueView step={step as StructureStep} prev={prev as StructureStep | undefined} />;
    case 'circular-queue':
      return <CircularQueueView step={step as StructureStep} prev={prev as StructureStep | undefined} />;
    case 'linked-stack':
      return <LinkedNodes step={step as StructureStep} orientation="vertical" animationMs={ms} />;
    default:
      return <LinkedNodes step={step as StructureStep} orientation="horizontal" animationMs={ms} />;
  }
}
