import {
  ArrowDownToLine,
  ArrowRightToLine,
  ArrowUpFromLine,
  Bug,
  ChevronDown,
  Download,
  FastForward,
  Hammer,
  Pause,
  Play,
  RotateCcw,
  Square,
  Undo2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button, IconButton } from '../components/ui/Button';
import { Spinner, Toggle } from '../components/ui/misc';
import { EXAMPLES } from './examples';
import { useActiveFile, useFiles } from './files';
import { useSession } from './session';

export interface ToolbarActions {
  compile(): void;
  run(): void;
  debug(): void;
  stop(): void;
  reset(): void;
  command(c: 'step_into' | 'step_over' | 'step_out' | 'continue' | 'pause'): void;
}

function ExamplesMenu({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const create = useFiles((s) => s.create);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setOpen(!open)}>
        Examples <ChevronDown size={11} />
      </Button>
      {open && (
        <div className="absolute top-7 left-0 z-30 w-72 rounded border border-line-strong bg-raised py-1 shadow-xl shadow-black/40">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.file}
              type="button"
              className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-hover"
              onClick={() => {
                create(ex.file, ex.code);
                setOpen(false);
              }}
            >
              <span className="font-mono text-xs text-fg">{ex.file}</span>
              <span className="text-[11px] text-faint">{ex.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toolbar({ actions }: { actions: ToolbarActions }) {
  const file = useActiveFile();
  const create = useFiles((s) => s.create);
  const revert = useFiles((s) => s.revert);
  const sanitizers = useFiles((s) => s.sanitizers);
  const setSanitizers = useFiles((s) => s.setSanitizers);
  const phase = useSession((s) => s.phase);
  const connected = useSession((s) => s.connected);
  const sandbox = useSession((s) => s.sandbox);
  const debugging = useSession((s) => s.debugging);
  const running = useSession((s) => s.running);
  const upload = useRef<HTMLInputElement>(null);
  const idle = phase === 'idle';
  const ready = connected && Boolean(sandbox?.available);
  const paused = debugging && !running;

  const exportFile = () => {
    const blob = new Blob([file.code], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line bg-surface px-2 py-1.5">
      <ExamplesMenu disabled={!idle} />
      <input
        ref={upload}
        type="file"
        accept=".c,.h,text/x-csrc,text/plain"
        className="hidden"
        onChange={async (e) => {
          const picked = e.target.files?.[0];
          e.target.value = '';
          if (!picked) {
            return;
          }
          if (picked.size > 256 * 1024) {
            window.alert('File too large (limit 256 KB).');
            return;
          }
          create(picked.name, await picked.text());
        }}
      />
      <IconButton label="Import .c file" onClick={() => upload.current?.click()} disabled={!idle}>
        <Upload size={13} />
      </IconButton>
      <IconButton label="Export .c file" onClick={exportFile}>
        <Download size={13} />
      </IconButton>
      <IconButton
        label="Revert file to its original content"
        disabled={!idle || file.code === file.original}
        onClick={() => window.confirm(`Revert ${file.name} to its original content?`) && revert(file.id)}
      >
        <Undo2 size={13} />
      </IconButton>

      <span className="mx-1 h-5 w-px bg-line" />

      <Button size="sm" icon={<Hammer size={12} />} onClick={actions.compile} disabled={!idle || !ready} title="Compile with GCC">
        Compile
      </Button>
      <Button size="sm" variant="primary" icon={<Play size={12} />} onClick={actions.run} disabled={!idle || !ready} title="Compile and run (Ctrl+Enter)">
        Run
      </Button>
      <Button size="sm" icon={<Bug size={12} />} onClick={actions.debug} disabled={!idle || !ready} title="Compile with -g -O0 and debug with GDB (F5)">
        Debug
      </Button>
      <Button size="sm" variant="danger" icon={<Square size={11} />} onClick={actions.stop} disabled={idle} title="Stop (Shift+F5)">
        Stop
      </Button>
      <IconButton label="Reset: stop and clear terminal and debugger state" onClick={actions.reset}>
        <RotateCcw size={13} />
      </IconButton>
      <Toggle checked={sanitizers} onChange={setSanitizers} label="Sanitizers" title="Run builds use -fsanitize=address,undefined" />

      {debugging && (
        <>
          <span className="mx-1 h-5 w-px bg-line" />
          <div className="flex items-center gap-1">
            {paused ? (
              <IconButton label="Continue (F5)" tone="accent" onClick={() => actions.command('continue')}>
                <FastForward size={13} />
              </IconButton>
            ) : (
              <IconButton label="Pause" onClick={() => actions.command('pause')}>
                <Pause size={13} />
              </IconButton>
            )}
            <IconButton label="Step Over (F10)" disabled={!paused} onClick={() => actions.command('step_over')}>
              <ArrowRightToLine size={13} />
            </IconButton>
            <IconButton label="Step Into (F11)" disabled={!paused} onClick={() => actions.command('step_into')}>
              <ArrowDownToLine size={13} />
            </IconButton>
            <IconButton label="Step Out (Shift+F11)" disabled={!paused} onClick={() => actions.command('step_out')}>
              <ArrowUpFromLine size={13} />
            </IconButton>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-2 font-mono text-[11px] text-faint">
        {phase !== 'idle' && !paused && <Spinner />}
        <span className={phase === 'idle' ? '' : 'text-cyan'}>
          {phase === 'debugging' ? (running ? 'running (debug)' : 'paused') : phase}
        </span>
      </div>
    </div>
  );
}
