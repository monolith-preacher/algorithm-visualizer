import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { DebugValue } from '@av/shared';

import { EmptyState } from '../../components/ui/misc';
import { cx } from '../../lib/cx';
import { useSession } from '../session';
import { displayValue, frameValues, previousValues } from './values';

function ValueRow({ value, depth, previous }: { value: DebugValue; depth: number; previous: Map<string, string> }) {
  const expandable = (value.children?.length ?? 0) > 0;
  const [open, setOpen] = useState(depth === 0 && expandable && (value.children?.length ?? 0) <= 8);
  const before = previous.get(value.expression);
  const changed = before !== undefined && before !== value.value;
  return (
    <>
      <div
        className={cx('flex items-baseline gap-1.5 py-[2px] pr-3 font-mono text-xs hover:bg-hover', expandable && 'cursor-pointer')}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => expandable && setOpen(!open)}
        title={`${value.type}${value.address ? ` @ ${value.address}` : ''}${value.sizeBytes ? ` · ${value.sizeBytes} B` : ''}`}
      >
        <span className="w-3 shrink-0 text-faint">{expandable ? open ? <ChevronDown size={11} /> : <ChevronRight size={11} /> : null}</span>
        <span className="shrink-0 text-muted">{value.name}</span>
        <span className="shrink-0 text-[10.5px] text-faint">{value.type}</span>
        <span
          className={cx(
            'ml-auto truncate text-right',
            value.error ? 'text-st-swap' : changed ? 'text-st-compare' : value.kind === 'pointer' ? 'text-cyan' : 'text-fg',
          )}
        >
          {value.error ?? displayValue(value)}
        </span>
      </div>
      {open && value.children?.map((child) => <ValueRow key={child.expression} value={child} depth={depth + 1} previous={previous} />)}
      {open && value.truncated && (
        <div className="py-[2px] font-mono text-[11px] text-faint" style={{ paddingLeft: 30 + depth * 14 }}>
          … more elements not shown
        </div>
      )}
    </>
  );
}

function Group({ title, values, previous }: { title: string; values: DebugValue[]; previous: Map<string, string> }) {
  if (values.length === 0) {
    return null;
  }
  return (
    <div className="mb-1">
      <div className="px-3 pt-1.5 pb-0.5 font-mono text-[10px] tracking-wider text-faint uppercase">{title}</div>
      {values.map((v) => (
        <ValueRow key={v.expression} value={v} depth={0} previous={previous} />
      ))}
    </div>
  );
}

export function VariablesPanel() {
  const snapshot = useSession((s) => s.snapshot);
  const previousSnapshot = useSession((s) => s.previousSnapshot);
  const selected = useSession((s) => s.selectedFrame);
  if (!snapshot) {
    return <EmptyState title="no paused program">Start a debug session (F5) and step through the code to inspect variables.</EmptyState>;
  }
  const frame = snapshot.frames.find((f) => f.level === selected);
  const previous = previousValues(previousSnapshot, frame);
  return (
    <div className="h-full overflow-auto py-1">
      {snapshot.returnValue && (
        <div className="mx-2 mb-1 rounded border border-accent-dim/60 bg-accent/5 px-2 py-1 font-mono text-xs">
          <span className="text-faint">{snapshot.returnValue.func}() returned </span>
          <span className="text-accent">{snapshot.returnValue.value}</span>
        </div>
      )}
      {frame && !frame.user && <div className="px-3 py-1 font-mono text-xs text-faint">{frame.func}: no debug information (library code)</div>}
      <Group title="Arguments" values={frame?.args ?? []} previous={previous} />
      <Group title="Locals" values={frame?.locals ?? []} previous={previous} />
      <Group title="Globals" values={snapshot.globals} previous={previous} />
      {frameValues(snapshot, selected).length === 0 && snapshot.globals.length === 0 && <EmptyState title="no variables in scope" />}
    </div>
  );
}
