import type { TraceEvent, VarValue, Vars } from './events';
import { FrameTracker, eventLine, type StepBase } from './frames';
import type { SourceMap } from './source';

/** One invocation in the recursion tree. */
export interface CallNode {
  id: number;
  parent: number | null;
  children: number[];
  fn: string;
  args: Vars;
  depth: number;
  /** Step at which the call happens and at which it returns. */
  callStep: number;
  returnStep: number | null;
  value?: VarValue;
}

export interface HanoiMove {
  disk: number;
  from: string;
  to: string;
}

export interface RecursionStep extends StepBase {
  /** Innermost call (the one executing). */
  active: number | null;
  /** Hanoi only: peg contents (bottom first) and the move performed by this step. */
  pegs?: number[][];
  move?: HanoiMove | null;
  moves?: number;
}

export interface RecursionTrace {
  kind: 'recursion';
  nodes: CallNode[];
  steps: RecursionStep[];
  result: Record<string, unknown> | null;
  maxDepth: number;
  truncated: boolean;
}

interface TowersState {
  pegs: number[][];
  moves: number;
}

const PEGS = ['A', 'B', 'C'];

export function buildRecursionTrace(events: TraceEvent[], source: SourceMap): RecursionTrace {
  const frames = new FrameTracker();
  const nodes: CallNode[] = [];
  const stack: number[] = [];
  const steps: RecursionStep[] = [];
  let result: Record<string, unknown> | null = null;
  let truncated = false;
  let maxDepth = 0;
  let towers: TowersState | null = null;
  let pendingPop = false;

  const push = (kind: string, line: number | null, move: HanoiMove | null = null): void => {
    const step: RecursionStep = {
      kind,
      line,
      frames: frames.snapshot(),
      active: stack[stack.length - 1] ?? null,
    };
    if (towers) {
      step.pegs = towers.pegs.map((peg) => [...peg]);
      step.move = move;
      step.moves = towers.moves;
    }
    steps.push(step);
  };

  for (const event of events) {
    if (pendingPop) {
      stack.pop();
      pendingPop = false;
    }
    if (event.state && typeof event.state === 'object' && 'pegs' in event.state) {
      towers = structuredClone(event.state as TowersState);
    }
    if (steps.length === 0 && event.t !== 'end' && event.t !== 'error') {
      push('start', null);
    }
    frames.apply(event);
    const line = eventLine(event, source);

    switch (event.t) {
      case 'call': {
        const parent = stack[stack.length - 1] ?? null;
        const node: CallNode = {
          id: nodes.length,
          parent,
          children: [],
          fn: event.fn,
          args: { ...event.vars },
          depth: stack.length,
          callStep: steps.length,
          returnStep: null,
        };
        nodes.push(node);
        if (parent !== null) {
          nodes[parent]?.children.push(node.id);
        }
        stack.push(node.id);
        maxDepth = Math.max(maxDepth, stack.length);
        push('call', line);
        break;
      }
      case 'return': {
        const node = nodes[stack[stack.length - 1] ?? -1];
        if (node) {
          node.returnStep = steps.length;
          node.value = event.value;
        }
        push('return', line);
        pendingPop = true;
        break;
      }
      case 'move': {
        if (towers) {
          const from = towers.pegs[PEGS.indexOf(event.from)];
          const to = towers.pegs[PEGS.indexOf(event.to)];
          const disk = from?.pop();
          if (disk !== undefined) {
            to?.push(disk);
          }
          towers.moves++;
        }
        push('move', line, { disk: event.disk, from: event.from, to: event.to });
        break;
      }
      case 'step':
        push('step', line);
        break;
      case 'end':
        result = event.result;
        truncated = event.truncated;
        if (result && typeof result['state'] === 'object') {
          towers = structuredClone(result['state'] as TowersState);
        }
        break;
      case 'error':
        throw new Error(event.message);
      default:
        break;
    }
  }
  if (pendingPop) {
    stack.pop();
  }
  push('end', null);
  const last = steps[steps.length - 1];
  if (last) {
    last.frames = [];
    last.active = null;
  }
  return { kind: 'recursion', nodes, steps, result, maxDepth, truncated };
}
