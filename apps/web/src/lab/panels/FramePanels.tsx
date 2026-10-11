import type { Frame, SourceMap, VarValue, Vars } from '@av/shared';

import { EmptyState, PanelHeader } from '../../components/ui/misc';
import { cx } from '../../lib/cx';
import { formatVar } from '../../lib/format';

function VarRow({ name, value, previous }: { name: string; value: VarValue; previous: VarValue | undefined }) {
  const changed = previous !== undefined && previous !== value;
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-0.5 font-mono text-xs">
      <span className="truncate text-muted">{name}</span>
      <span
        className={cx(
          'truncate tabular-nums transition-colors',
          changed ? 'text-st-compare' : typeof value === 'string' || value === null ? 'text-cyan' : 'text-fg',
        )}
        title={String(value)}
      >
        {formatVar(value)}
      </span>
    </div>
  );
}

/** Watched variables of the innermost frame; values that changed since the previous step are highlighted. */
export function VariablesPanel({ vars, previous }: { vars: Vars | undefined; previous: Vars | undefined }) {
  const entries = Object.entries(vars ?? {});
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader title="Variables" />
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {entries.length === 0 ? (
          <EmptyState title="no frame" />
        ) : (
          entries.map(([name, value]) => <VarRow key={name} name={name} value={value} previous={previous?.[name]} />)
        )}
      </div>
    </div>
  );
}

export function CallStackPanel({ frames, map }: { frames: Frame[]; map: SourceMap | null }) {
  const ordered = [...frames].reverse();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader title={`Call stack · ${frames.length}`} />
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {ordered.length === 0 && <EmptyState title="empty" />}
        {ordered.map((frame, i) => {
          const args = Object.entries(frame.vars)
            .slice(0, 4)
            .map(([k, v]) => `${k}=${formatVar(v)}`)
            .join(', ');
          const returnsBool = map?.returnType(frame.fn) === 'bool';
          return (
            <div
              key={frame.id}
              className={cx(
                'flex items-baseline justify-between gap-2 border-l-2 px-3 py-1 font-mono text-xs',
                i === 0 ? 'border-cyan bg-cyan/5' : 'border-transparent',
              )}
            >
              <span className="truncate">
                <span className={i === 0 ? 'text-cyan' : 'text-muted'}>{frame.fn}</span>
                <span className="text-faint">({args})</span>
              </span>
              {frame.returning && (
                <span className="shrink-0 text-accent">→ {formatVar(frame.returnValue, returnsBool)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
