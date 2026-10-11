import { Eraser, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { STRUCTURE_LIMITS, type AlgorithmInfo, type OperationSpec, type StructureOperation } from '@av/shared';

import { Button, IconButton } from '../../components/ui/Button';
import { PanelHeader, Toggle } from '../../components/ui/misc';
import { cx } from '../../lib/cx';

export interface HistoryEntry {
  op: StructureOperation;
  result?: { ok: boolean; value?: number; values?: number[] };
}

const randomValue = () => 1 + Math.floor(Math.random() * 99);

function describeResult(entry: HistoryEntry): string {
  const r = entry.result;
  if (!r) {
    return '';
  }
  if (r.values) {
    return `[${r.values.join(', ')}]`;
  }
  if (entry.op.name === 'search') {
    return r.ok ? `index ${r.value}` : '-1';
  }
  if (r.value !== undefined && r.ok) {
    return `${r.value}`;
  }
  return r.ok ? 'true' : 'false';
}

interface OperationsPanelProps {
  algorithm: AlgorithmInfo;
  history: HistoryEntry[];
  size: number;
  busy: boolean;
  onRun: (op: StructureOperation, failAlloc: boolean) => void;
  onUndo: () => void;
  onClear: () => void;
}

/** Buttons for the operations of a data structure; every call runs the C implementation. */
export function OperationsPanel({ algorithm, history, size, busy, onRun, onUndo, onClear }: OperationsPanelProps) {
  const [value, setValue] = useState(randomValue);
  const [index, setIndex] = useState(0);
  const [failAlloc, setFailAlloc] = useState(false);
  const ops = algorithm.operations ?? [];
  const dynamic = ops.some((o) => o.allocates) && algorithm.visual !== 'array-stack' && algorithm.visual !== 'array-queue' && algorithm.visual !== 'circular-queue';
  const full = size >= STRUCTURE_LIMITS.maxNodes;
  const tooMany = history.length >= STRUCTURE_LIMITS.maxOperations;

  const run = (spec: OperationSpec) => {
    const args = spec.args.map((a) => (a === 'index' ? index : value));
    onRun({ name: spec.name, args }, failAlloc && Boolean(spec.allocates));
    if (spec.allocates) {
      setFailAlloc(false);
    }
    if (spec.args.includes('value') && spec.allocates) {
      setValue(randomValue());
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader title="Operations">
        <IconButton label="Undo last operation" onClick={onUndo} disabled={busy || history.length === 0} className="h-6 w-6">
          <Undo2 size={12} />
        </IconButton>
        <IconButton label="Clear (empty structure)" onClick={onClear} disabled={busy || history.length === 0} className="h-6 w-6">
          <Eraser size={12} />
        </IconButton>
      </PanelHeader>
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 font-mono text-[11px] text-faint">
            value
            <input
              type="number"
              className="input w-16"
              value={value}
              min={STRUCTURE_LIMITS.valueMin}
              max={STRUCTURE_LIMITS.valueMax}
              onChange={(e) => setValue(Math.max(-999, Math.min(999, Number(e.target.value) || 0)))}
            />
          </label>
          {ops.some((o) => o.args.includes('index')) && (
            <label className="flex items-center gap-1.5 font-mono text-[11px] text-faint">
              index
              <input
                type="number"
                className="input w-14"
                value={index}
                min={0}
                max={64}
                onChange={(e) => setIndex(Math.max(0, Math.min(64, Number(e.target.value) || 0)))}
              />
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ops.map((spec) => (
            <Button
              key={spec.name}
              size="sm"
              variant={spec.allocates ? 'primary' : 'default'}
              disabled={busy || tooMany || (spec.allocates && full)}
              onClick={() => run(spec)}
              title={`${spec.label} · ${spec.complexity}`}
            >
              {spec.label}
            </Button>
          ))}
        </div>
        {dynamic && (
          <Toggle
            checked={failAlloc}
            onChange={setFailAlloc}
            label="Fail next malloc"
            title="The next allocation returns NULL, exercising the C error path"
          />
        )}
        {full && <span className="font-mono text-[10.5px] text-st-compare">Visual limit: {STRUCTURE_LIMITS.maxNodes} nodes</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {history.length === 0 && <div className="px-3 py-2 font-mono text-[11px] text-faint">empty structure</div>}
        {history.map((entry, i) => (
          <div
            key={i}
            className={cx(
              'flex items-baseline justify-between gap-2 px-3 py-0.5 font-mono text-[11px]',
              i === history.length - 1 && 'bg-cyan/5',
            )}
          >
            <span className="truncate">
              <span className="text-faint">{String(i + 1).padStart(2, '0')} </span>
              <span className={entry.op.name === 'fail_next_alloc' ? 'text-st-swap' : 'text-muted'}>{entry.op.name}</span>
              <span className="text-fg"> {entry.op.args.join(' ')}</span>
            </span>
            <span className={entry.result?.ok === false ? 'text-st-swap' : 'text-accent'}>{describeResult(entry)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
