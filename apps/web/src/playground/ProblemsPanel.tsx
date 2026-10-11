import { AlertTriangle, CircleX, Info } from 'lucide-react';

import { EmptyState } from '../components/ui/misc';
import { revealLine } from './CodeEditor';
import { useActiveFile } from './files';
import { useSession } from './session';

export function ProblemsPanel() {
  const diagnostics = useSession((s) => s.diagnostics);
  const compile = useSession((s) => s.compile);
  const file = useActiveFile();
  if (!compile) {
    return <EmptyState title="not compiled yet" />;
  }
  if (diagnostics.length === 0) {
    return <EmptyState title={compile.ok ? 'no warnings or errors' : 'see the terminal for compiler output'} />;
  }
  return (
    <div className="h-full overflow-auto py-1">
      {diagnostics.map((d, i) => (
        <button
          key={i}
          type="button"
          onClick={() => revealLine(file.id, d.line, d.column)}
          className="flex w-full items-start gap-2 px-3 py-1 text-left font-mono text-xs hover:bg-hover"
        >
          {d.severity === 'error' ? (
            <CircleX size={13} className="mt-0.5 shrink-0 text-st-swap" />
          ) : d.severity === 'warning' ? (
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-st-compare" />
          ) : (
            <Info size={13} className="mt-0.5 shrink-0 text-cyan" />
          )}
          <span className="text-fg/90">{d.message}</span>
          <span className="ml-auto shrink-0 text-faint">
            {d.line}:{d.column}
          </span>
        </button>
      ))}
    </div>
  );
}
