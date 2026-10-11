import { useFiles } from './files';

/** stdin used by debug sessions (GDB runs the program with this file as input). */
export function InputPanel() {
  const stdin = useFiles((s) => s.stdin);
  const setStdin = useFiles((s) => s.setStdin);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="border-b border-line px-3 py-1.5 text-[11px] text-faint">
        Input passed to the program when debugging. <span className="text-muted">Run</span> mode reads stdin interactively from the terminal.
      </p>
      <textarea
        className="min-h-0 flex-1 resize-none bg-panel px-3 py-2 font-mono text-xs text-fg outline-none placeholder:text-faint"
        value={stdin}
        spellCheck={false}
        onChange={(e) => setStdin(e.target.value)}
        placeholder={'e.g.\n42\nAda 1815'}
        aria-label="Debug stdin"
      />
    </div>
  );
}
