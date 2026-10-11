import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { CallNode, RecursionTrace, VarValue } from '@av/shared';

import { IconButton } from '../../components/ui/Button';

const COL = 58;
const ROW = 62;
const NODE_W = 52;
const NODE_H = 24;

interface Layout {
  x: number[];
  width: number;
  height: number;
}

/** Leaves are placed left to right in call order; a parent is centred over its children. */
function layoutTree(nodes: CallNode[]): Layout {
  const x = new Array<number>(nodes.length).fill(0);
  let next = 0;
  let maxDepth = 0;
  const visit = (id: number): void => {
    const node = nodes[id];
    if (!node) {
      return;
    }
    maxDepth = Math.max(maxDepth, node.depth);
    if (node.children.length === 0) {
      x[id] = next++;
      return;
    }
    node.children.forEach(visit);
    const first = x[node.children[0] ?? id] ?? 0;
    const last = x[node.children[node.children.length - 1] ?? id] ?? 0;
    x[id] = (first + last) / 2;
  };
  nodes.filter((n) => n.parent === null).forEach((n) => visit(n.id));
  return { x, width: Math.max(1, next) * COL + 20, height: (maxDepth + 1) * ROW + 20 };
}

function argText(args: Record<string, VarValue>): string {
  return Object.values(args)
    .map((v) => String(v))
    .join(', ');
}

/** Recursion tree of factorial / Fibonacci: calls appear as they happen and show their return values. */
export function CallTree({ trace, index }: { trace: RecursionTrace; index: number }) {
  const layout = useMemo(() => layoutTree(trace.nodes), [trace.nodes]);
  const [fit, setFit] = useState(layout.width < 900);
  const scroller = useRef<HTMLDivElement>(null);
  const step = trace.steps[index];
  const active = step?.active ?? null;
  const nodeX = (id: number) => 10 + (layout.x[id] ?? 0) * COL + COL / 2;
  const nodeY = (depth: number) => 10 + depth * ROW + NODE_H / 2;

  // In actual-size mode, keep the executing call in view.
  useEffect(() => {
    if (fit || active === null || !scroller.current) {
      return;
    }
    const el = scroller.current;
    const x = 10 + (layout.x[active] ?? 0) * COL + COL / 2;
    el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), behavior: 'smooth' });
  }, [active, fit, layout]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="absolute top-2 right-2 z-10">
        <IconButton label={fit ? 'Actual size' : 'Fit to view'} onClick={() => setFit(!fit)}>
          {fit ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
        </IconButton>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto p-3">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={fit ? '100%' : layout.width}
          height={fit ? '100%' : layout.height}
          preserveAspectRatio="xMidYMin meet"
          className="mx-auto"
        >
          {trace.nodes.map((node) => {
            if (node.parent === null || node.callStep > index) {
              return null;
            }
            const parent = trace.nodes[node.parent];
            if (!parent) {
              return null;
            }
            const live = node.returnStep === null || node.returnStep > index;
            return (
              <line
                key={`e${node.id}`}
                x1={nodeX(parent.id)}
                y1={nodeY(parent.depth) + NODE_H / 2}
                x2={nodeX(node.id)}
                y2={nodeY(node.depth) - NODE_H / 2}
                stroke={live ? 'var(--color-cyan-dim)' : 'var(--color-line-strong)'}
                strokeWidth={live ? 1.5 : 1}
              />
            );
          })}
          {trace.nodes.map((node) => {
            if (node.callStep > index) {
              return null;
            }
            const returned = node.returnStep !== null && node.returnStep <= index;
            const isActive = node.id === active;
            const stroke = isActive ? 'var(--color-cyan)' : returned ? 'var(--color-accent-dim)' : 'var(--color-cyan-dim)';
            const cx = nodeX(node.id);
            const cy = nodeY(node.depth);
            return (
              <g key={node.id}>
                <rect
                  x={cx - NODE_W / 2}
                  y={cy - NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx={4}
                  fill={isActive ? 'color-mix(in srgb, var(--color-cyan) 16%, var(--color-panel))' : 'var(--color-panel)'}
                  stroke={stroke}
                  strokeWidth={isActive ? 1.6 : 1}
                  style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(34,211,238,.45))' } : undefined}
                />
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={11}
                  fill={returned ? 'var(--color-muted)' : 'var(--color-fg)'}
                >
                  {node.fn === 'factorial' ? 'fact' : node.fn === 'fibonacci' ? 'fib' : node.fn}({argText(node.args)})
                </text>
                {returned && (
                  <text x={cx} y={cy + NODE_H / 2 + 13} textAnchor="middle" className="font-mono" fontSize={10.5} fill="var(--color-accent)">
                    = {String(node.value)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
