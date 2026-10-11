import { EmptyState } from '../../components/ui/misc';
import { cx } from '../../lib/cx';
import { useSession } from '../session';

export function CallStackPanel() {
  const snapshot = useSession((s) => s.snapshot);
  const selected = useSession((s) => s.selectedFrame);
  const selectFrame = useSession((s) => s.selectFrame);
  if (!snapshot) {
    return <EmptyState title="no paused program" />;
  }
  return (
    <div className="h-full overflow-auto py-1">
      {snapshot.signal && (
        <div className="mx-2 mb-1 rounded border border-st-danger/50 bg-st-danger/5 px-2 py-1 font-mono text-xs text-st-swap">
          {snapshot.signal.name} · {snapshot.signal.meaning}
        </div>
      )}
      {snapshot.frames.map((frame) => (
        <button
          key={frame.level}
          type="button"
          onClick={() => selectFrame(frame.level)}
          className={cx(
            'flex w-full items-baseline gap-2 border-l-2 px-3 py-1 text-left font-mono text-xs',
            frame.level === selected ? 'border-cyan bg-cyan/5' : 'border-transparent hover:bg-hover',
            !frame.user && 'opacity-50',
          )}
        >
          <span className="w-4 shrink-0 text-faint">#{frame.level}</span>
          <span className={frame.user ? 'text-fg' : 'text-muted'}>{frame.func}</span>
          <span className="truncate text-faint">
            ({frame.args.map((a) => `${a.name}=${a.kind === 'pointer' ? a.value.split(' ')[0] : a.value}`).join(', ')})
          </span>
          <span className="ml-auto shrink-0 text-faint">{frame.user ? `main.c:${frame.line}` : frame.address}</span>
        </button>
      ))}
    </div>
  );
}
