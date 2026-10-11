import { useEffect, useMemo, useState } from 'react';

import { Group, Handle, Panel } from '../components/ui/Resizable';
import { ErrorBox, Tabs } from '../components/ui/misc';
import type { HealthState } from '../lib/useHealth';
import { useIsDesktop } from '../lib/useMediaQuery';
import { CodeEditor, type EditorCommands } from './CodeEditor';
import { CallStackPanel } from './debug/CallStackPanel';
import { ConsolePanel } from './debug/ConsolePanel';
import { MemoryPanel } from './debug/MemoryPanel';
import { VariablesPanel } from './debug/VariablesPanel';
import { FileList } from './FileList';
import { useActiveFile, useFiles } from './files';
import { InputPanel } from './InputPanel';
import { ProblemsPanel } from './ProblemsPanel';
import { connect, send, useSession } from './session';
import { Terminal } from './Terminal';
import { Toolbar, type ToolbarActions } from './Toolbar';

type BottomTab = 'terminal' | 'problems' | 'input';
type DebugTab = 'variables' | 'stack' | 'memory' | 'console';

export default function PlaygroundPage({ health }: { health: HealthState }) {
  const desktop = useIsDesktop();
  const file = useActiveFile();
  const stdin = useFiles((s) => s.stdin);
  const sanitizers = useFiles((s) => s.sanitizers);
  const connected = useSession((s) => s.connected);
  const sandbox = useSession((s) => s.sandbox);
  const debugging = useSession((s) => s.debugging);
  const running = useSession((s) => s.running);
  const phase = useSession((s) => s.phase);
  const diagnostics = useSession((s) => s.diagnostics);
  const [bottom, setBottom] = useState<BottomTab>('terminal');
  const [debugTab, setDebugTab] = useState<DebugTab>('variables');

  useEffect(() => connect(), []);

  // Keep breakpoints in sync with a running debug session.
  useEffect(() => {
    if (debugging) {
      send({ type: 'debug_breakpoints', lines: file.breakpoints });
    }
  }, [debugging, file.breakpoints]);

  const actions: ToolbarActions & EditorCommands = useMemo(() => {
    const printStart = () => {
      const s = useSession.getState();
      s.reset();
      setBottom('terminal');
    };
    return {
      compile: () => {
        printStart();
        send({ type: 'compile', code: file.code, options: { sanitizers } });
      },
      run: () => {
        if (useSession.getState().phase !== 'idle') {
          return;
        }
        printStart();
        send({ type: 'run', code: file.code, options: { sanitizers } });
      },
      debug: () => {
        const s = useSession.getState();
        if (s.debugging) {
          if (!s.running) {
            send({ type: 'debug_command', command: 'continue' });
          }
          return;
        }
        if (s.phase !== 'idle') {
          return;
        }
        printStart();
        setDebugTab('variables');
        send({ type: 'debug_start', code: file.code, stdin, breakpoints: file.breakpoints });
      },
      stop: () => send({ type: 'stop' }),
      reset: () => {
        if (useSession.getState().phase !== 'idle') {
          send({ type: 'stop' });
        }
        useSession.getState().reset();
      },
      command: (command) => send({ type: 'debug_command', command }),
      stepOver: () => useSession.getState().debugging && send({ type: 'debug_command', command: 'step_over' }),
      stepInto: () => useSession.getState().debugging && send({ type: 'debug_command', command: 'step_into' }),
      stepOut: () => useSession.getState().debugging && send({ type: 'debug_command', command: 'step_out' }),
    };
  }, [file.code, file.breakpoints, sanitizers, stdin]);

  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const unavailable = !connected
    ? health.error ?? 'Connecting to the server…'
    : sandbox && !sandbox.available
      ? `C Playground unavailable: ${sandbox.reason ?? 'sandbox not ready'}`
      : null;

  const editorArea = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line bg-panel px-3 font-mono text-xs">
        <span className="text-fg">{file.name}</span>
        {file.code !== file.original && <span className="text-faint">modified</span>}
        <span className="ml-auto text-faint">
          {file.breakpoints.length > 0 && `${file.breakpoints.length} breakpoint${file.breakpoints.length > 1 ? 's' : ''} · `}
          gutter click toggles breakpoints
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor commands={actions} />
      </div>
    </div>
  );

  const bottomArea = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-stretch border-b border-line">
        <Tabs
          value={bottom}
          onChange={setBottom}
          tabs={[
            { id: 'terminal', label: 'Terminal' },
            { id: 'problems', label: `Problems${diagnostics.length ? ` · ${diagnostics.length}` : ''}` },
            { id: 'input', label: 'Debug input' },
          ]}
        />
        {errors > 0 && <span className="ml-2 self-center font-mono text-[11px] text-st-swap">{errors} error(s)</span>}
      </div>
      <div className="min-h-0 flex-1">
        {bottom === 'terminal' ? <Terminal /> : bottom === 'problems' ? <ProblemsPanel /> : <InputPanel />}
      </div>
    </div>
  );

  const debugArea = (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-stretch justify-between border-b border-line pr-2">
        <Tabs
          value={debugTab}
          onChange={setDebugTab}
          tabs={[
            { id: 'variables', label: 'Variables' },
            { id: 'stack', label: 'Call Stack' },
            { id: 'memory', label: 'Memory' },
            { id: 'console', label: 'Console' },
          ]}
        />
        {debugging && (
          <span className={`self-center font-mono text-[10.5px] ${running ? 'animate-pulse-soft text-st-compare' : 'text-accent'}`}>
            {running ? 'running' : 'paused'}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {debugTab === 'variables' ? (
          <VariablesPanel />
        ) : debugTab === 'stack' ? (
          <CallStackPanel />
        ) : debugTab === 'memory' ? (
          <MemoryPanel />
        ) : (
          <ConsolePanel />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Toolbar actions={actions} />
      {unavailable && (
        <div className="border-b border-line p-2">
          <ErrorBox>{unavailable}</ErrorBox>
        </div>
      )}
      {desktop ? (
        <Group orientation="horizontal" className="min-h-0 flex-1">
          <Panel defaultSize="190px" minSize="140px" maxSize="320px">
            <FileList disabled={phase !== 'idle'} />
          </Panel>
          <Handle />
          <Panel minSize="30%">
            <Group orientation="vertical">
              <Panel defaultSize="64%" minSize="25%">
                {editorArea}
              </Panel>
              <Handle direction="vertical" />
              <Panel defaultSize="36%" minSize="12%">
                {bottomArea}
              </Panel>
            </Group>
          </Panel>
          <Handle />
          <Panel defaultSize="36%" minSize="22%">
            {debugArea}
          </Panel>
        </Group>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="h-[55vh]">{editorArea}</div>
          <div className="h-[40vh] border-t border-line">{bottomArea}</div>
          <div className="h-[60vh] border-t border-line">{debugArea}</div>
          <div className="h-48 border-t border-line">
            <FileList disabled={phase !== 'idle'} />
          </div>
        </div>
      )}
    </div>
  );
}
