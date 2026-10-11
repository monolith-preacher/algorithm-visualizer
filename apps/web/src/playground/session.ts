import { create } from 'zustand';

import type {
  ClientMessage,
  CompileResult,
  DebugSnapshot,
  Diagnostic,
  ExecutionLimits,
  ExitInfo,
  SandboxStatus,
  ServerMessage,
  SessionPhase,
} from '@av/shared';

export type TerminalKind = 'stdout' | 'stderr' | 'system' | 'input' | 'error' | 'success';

export interface TerminalChunk {
  kind: TerminalKind;
  text: string;
}

export interface EvalEntry {
  id: number;
  expression: string;
  value?: string;
  valueType?: string;
  error?: string;
}

interface SessionState {
  connected: boolean;
  sandbox: SandboxStatus | null;
  limits: ExecutionLimits | null;
  phase: SessionPhase;
  terminal: TerminalChunk[];
  diagnostics: Diagnostic[];
  compile: CompileResult | null;
  exit: ExitInfo | null;
  debugging: boolean;
  running: boolean;
  snapshot: DebugSnapshot | null;
  previousSnapshot: DebugSnapshot | null;
  confirmedBreakpoints: number[];
  selectedFrame: number;
  evals: EvalEntry[];
  stdinClosed: boolean;
  print(kind: TerminalKind, text: string): void;
  clearTerminal(): void;
  selectFrame(level: number): void;
  reset(): void;
}

const MAX_TERMINAL_CHARS = 400_000;

export const useSession = create<SessionState>()((set, get) => ({
  connected: false,
  sandbox: null,
  limits: null,
  phase: 'idle',
  terminal: [],
  diagnostics: [],
  compile: null,
  exit: null,
  debugging: false,
  running: false,
  snapshot: null,
  previousSnapshot: null,
  confirmedBreakpoints: [],
  selectedFrame: 0,
  evals: [],
  stdinClosed: false,
  print: (kind, text) => {
    if (!text) {
      return;
    }
    const terminal = [...get().terminal];
    const last = terminal[terminal.length - 1];
    if (last && last.kind === kind) {
      terminal[terminal.length - 1] = { kind, text: last.text + text };
    } else {
      terminal.push({ kind, text });
    }
    let total = terminal.reduce((n, c) => n + c.text.length, 0);
    while (total > MAX_TERMINAL_CHARS && terminal.length > 1) {
      total -= terminal.shift()?.text.length ?? 0;
    }
    set({ terminal });
  },
  clearTerminal: () => set({ terminal: [] }),
  selectFrame: (level) => set({ selectedFrame: level }),
  reset: () =>
    set({ terminal: [], diagnostics: [], compile: null, exit: null, snapshot: null, previousSnapshot: null, evals: [], selectedFrame: 0 }),
}));

function handle(message: ServerMessage): void {
  const s = useSession.getState();
  switch (message.type) {
    case 'hello':
      useSession.setState({ sandbox: message.sandbox, limits: message.limits });
      return;
    case 'phase':
      useSession.setState({
        phase: message.phase,
        ...(message.phase === 'running' ? { stdinClosed: false, exit: null } : {}),
        ...(message.phase === 'debugging' ? { debugging: true, running: true, snapshot: null, previousSnapshot: null, evals: [] } : {}),
        ...(message.phase === 'idle' ? { debugging: false, running: false } : {}),
      });
      return;
    case 'compile_result': {
      const r = message.result;
      useSession.setState({ compile: r, diagnostics: r.diagnostics });
      s.print('system', `$ ${r.command}\n`);
      if (r.output) {
        s.print(r.ok ? 'stderr' : 'error', `${r.output}\n`);
      }
      s.print(
        r.ok ? 'success' : 'error',
        r.ok
          ? `Compiled in ${r.durationMs} ms${r.diagnostics.length ? ` with ${r.diagnostics.length} warning(s)` : ''}\n`
          : `Compilation failed (${r.diagnostics.filter((d) => d.severity === 'error').length} error(s))\n`,
      );
      return;
    }
    case 'output':
      s.print(message.stream, message.data);
      return;
    case 'exit': {
      useSession.setState({ exit: message.info });
      const ok = message.info.reason === 'exited' && message.info.exitCode === 0;
      const tail = s.terminal[s.terminal.length - 1]?.text.endsWith('\n') ?? true;
      s.print(ok ? 'success' : 'error', `${tail ? '' : '\n'}${message.info.message}\n`);
      return;
    }
    case 'debug_paused':
      useSession.setState({
        running: false,
        previousSnapshot: s.snapshot,
        snapshot: message.snapshot,
        selectedFrame: message.snapshot.frames.find((f) => f.user)?.level ?? 0,
      });
      if (message.snapshot.signal) {
        s.print('error', `\nProgram received ${message.snapshot.signal.name}: ${message.snapshot.signal.meaning}\n`);
      }
      return;
    case 'debug_running':
      useSession.setState({ running: true });
      return;
    case 'debug_breakpoints':
      useSession.setState({ confirmedBreakpoints: message.lines });
      return;
    case 'debug_eval':
      useSession.setState({
        evals: s.evals.map((e) =>
          e.id === message.id
            ? {
                ...e,
                ...(message.value !== undefined ? { value: message.value } : {}),
                ...(message.valueType !== undefined ? { valueType: message.valueType } : {}),
                ...(message.error !== undefined ? { error: message.error } : {}),
              }
            : e,
        ),
      });
      return;
    case 'debug_ended': {
      useSession.setState({ debugging: false, running: false, snapshot: null, exit: message.info });
      const ok = message.info.reason === 'exited' && message.info.exitCode === 0;
      s.print(ok ? 'success' : message.info.reason === 'killed' ? 'system' : 'error', `\n${message.info.message}\n`);
      return;
    }
    case 'error':
      s.print('error', `${message.message}\n`);
      return;
  }
}

let socket: WebSocket | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let users = 0;

function open(): void {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/playground`;
  const ws = new WebSocket(url);
  socket = ws;
  ws.onopen = () => {
    retry = 0;
    useSession.setState({ connected: true });
  };
  ws.onmessage = (event) => {
    try {
      handle(JSON.parse(String(event.data)) as ServerMessage);
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onclose = () => {
    if (socket !== ws) {
      return;
    }
    socket = null;
    const wasActive = useSession.getState().phase !== 'idle';
    useSession.setState({ connected: false, phase: 'idle', debugging: false, running: false, snapshot: null });
    if (wasActive) {
      useSession.getState().print('error', '\nConnection to the server lost; the session was terminated.\n');
    }
    if (users > 0) {
      retryTimer = setTimeout(open, Math.min(10000, 500 * 2 ** retry++));
    }
  };
}

/** Opens the Playground WebSocket while at least one component uses it. */
export function connect(): () => void {
  users++;
  if (!socket) {
    open();
  }
  return () => {
    users--;
    if (users === 0) {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      const ws = socket;
      socket = null;
      ws?.close();
      useSession.setState({ connected: false });
    }
  };
}

export function send(message: ClientMessage): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    useSession.getState().print('error', 'Not connected to the server.\n');
    return false;
  }
  socket.send(JSON.stringify(message));
  return true;
}

let evalId = 1;
export function evaluate(expression: string): void {
  const id = evalId++;
  const { selectedFrame, evals } = useSession.getState();
  useSession.setState({ evals: [...evals, { id, expression }] });
  send({ type: 'debug_evaluate', id, expression, frame: selectedFrame });
}
