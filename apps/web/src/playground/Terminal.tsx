import { CornerDownLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../components/ui/Button';
import { cx } from '../lib/cx';
import { send, useSession, type TerminalKind } from './session';

const TONE: Record<TerminalKind, string> = {
  stdout: 'text-fg',
  stderr: 'text-st-compare',
  input: 'text-cyan',
  system: 'text-faint',
  error: 'text-st-swap',
  success: 'text-accent',
};

/** Program output (stdout/stderr), compiler messages and interactive stdin. */
export function Terminal() {
  const terminal = useSession((s) => s.terminal);
  const phase = useSession((s) => s.phase);
  const stdinClosed = useSession((s) => s.stdinClosed);
  const print = useSession((s) => s.print);
  const [line, setLine] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const running = phase === 'running';

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [terminal]);

  const submit = () => {
    if (!running || stdinClosed) {
      return;
    }
    send({ type: 'stdin', data: `${line}\n` });
    print('input', `${line}\n`);
    setLine('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[12.5px] leading-[1.55]"
      >
        {terminal.length === 0 ? (
          <span className="text-faint">Compile (Ctrl+Enter runs) to see compiler messages and program output here.</span>
        ) : (
          <pre className="break-words whitespace-pre-wrap">
            {terminal.map((chunk, i) => (
              <span key={i} className={TONE[chunk.kind]}>
                {chunk.text}
              </span>
            ))}
          </pre>
        )}
      </div>
      <form
        className="flex items-center gap-2 border-t border-line px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span className={cx('font-mono text-xs', running && !stdinClosed ? 'text-cyan' : 'text-faint')}>stdin ›</span>
        <input
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-fg outline-none placeholder:text-faint"
          value={line}
          onChange={(e) => setLine(e.target.value)}
          placeholder={running ? (stdinClosed ? 'stdin closed (EOF sent)' : 'type a line and press Enter') : 'available while a program runs'}
          disabled={!running || stdinClosed}
          aria-label="Program input"
        />
        <Button size="sm" variant="ghost" type="submit" disabled={!running || stdinClosed} icon={<CornerDownLeft size={11} />}>
          Send
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!running || stdinClosed}
          title="Close stdin (Ctrl+D)"
          onClick={() => {
            send({ type: 'stdin_eof' });
            useSession.setState({ stdinClosed: true });
            print('system', '^D\n');
          }}
        >
          EOF
        </Button>
      </form>
    </div>
  );
}
