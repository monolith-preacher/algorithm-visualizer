import { useEffect, useRef, useState } from 'react';

import { EmptyState } from '../../components/ui/misc';
import { evaluate, useSession } from '../session';

/** Evaluates C expressions in the selected frame through GDB. */
export function ConsolePanel() {
  const evals = useSession((s) => s.evals);
  const snapshot = useSession((s) => s.snapshot);
  const selected = useSession((s) => s.selectedFrame);
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [evals]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed">
        {evals.length === 0 && (
          <EmptyState title="expression console">
            Evaluate C expressions in the selected frame, e.g. <span className="text-muted">head-&gt;next-&gt;value</span>,{' '}
            <span className="text-muted">arr[i] * 2</span> or <span className="text-muted">sizeof(Node)</span>.
          </EmptyState>
        )}
        {evals.map((e) => (
          <div key={e.id} className="mb-1">
            <div className="text-cyan">› {e.expression}</div>
            {e.error ? (
              <div className="text-st-swap">{e.error}</div>
            ) : e.value !== undefined ? (
              <div className="text-fg">
                {e.value} <span className="text-faint">({e.valueType})</span>
              </div>
            ) : (
              <div className="text-faint">…</div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="flex items-center gap-2 border-t border-line px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const text = expression.trim();
          if (!text || !snapshot) {
            return;
          }
          evaluate(text);
          setHistory((h) => [...h, text]);
          setCursor(-1);
          setExpression('');
        }}
      >
        <span className="font-mono text-xs text-faint">#{selected} ›</span>
        <input
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-fg outline-none placeholder:text-faint"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' && history.length > 0) {
              e.preventDefault();
              const next = cursor < 0 ? history.length - 1 : Math.max(0, cursor - 1);
              setCursor(next);
              setExpression(history[next] ?? '');
            }
          }}
          maxLength={512}
          disabled={!snapshot}
          placeholder={snapshot ? 'C expression' : 'pause the program to evaluate'}
          aria-label="Expression"
        />
      </form>
    </div>
  );
}
