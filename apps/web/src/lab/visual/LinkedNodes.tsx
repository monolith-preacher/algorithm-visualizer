import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';

import { entryPointer, isPointer, layoutLinked, type HeapNode, type StructureStep } from '@av/shared';

import { shortAddr } from '../../lib/format';

type Orientation = 'horizontal' | 'vertical';

const CELL_H = 34;
const VALUE_W = 52;
const PTR_W = 38;
const GAP = 64;
const PAD_X = 40;
const LABEL_SPACE = 46;
/** Horizontal layouts: detached (unlinked) nodes on top, the chain below. */
const CHAIN_Y = LABEL_SPACE + CELL_H + 76;

/** Struct fields that point into the chain, by structure kind. */
const ROOTS = ['head', 'tail', 'top', 'front', 'rear'] as const;

interface Placed {
  node: HeapNode;
  x: number;
  y: number;
  detached: boolean;
}

interface Edge {
  key: string;
  d: string;
  kind: 'next' | 'prev';
}

function nodeWidth(doubly: boolean): number {
  return doubly ? PTR_W * 2 + VALUE_W : VALUE_W + PTR_W;
}

function PointerCell({ value, live, label }: { value: string | null | undefined; live: Set<string>; label: string }) {
  if (value === null || value === undefined) {
    return <span className="text-[10px] text-faint" title={`${label} = NULL`}>NULL</span>;
  }
  if (live.has(value)) {
    return <span className="h-1.5 w-1.5 rounded-full bg-cyan" title={`${label} = ${value}`} />;
  }
  // Not the address of a live node: indeterminate bytes or a dangling pointer.
  return (
    <span className="text-[9px] text-st-swap/80" title={`${label} = ${value} (not a live node)`}>
      ?
    </span>
  );
}

export function LinkedNodes({
  step,
  orientation,
  animationMs,
}: {
  step: StructureStep;
  orientation: Orientation;
  animationMs: number;
}) {
  const state = step.state;
  const doubly = (state.nodes ?? []).some((n) => n.prev !== undefined);
  const W = nodeWidth(doubly);
  const layout = useMemo(() => layoutLinked(state, entryPointer(state)), [state]);
  const live = useMemo(() => new Set((state.nodes ?? []).map((n) => n.addr)), [state.nodes]);

  const placed: Placed[] = [];
  const vertical = orientation === 'vertical';
  layout.chain.forEach((node, i) => {
    placed.push(
      vertical
        ? { node, x: PAD_X, y: LABEL_SPACE + i * (CELL_H + GAP), detached: false }
        : { node, x: PAD_X + i * (W + GAP), y: CHAIN_Y, detached: false },
    );
  });
  layout.detached.forEach((node, i) => {
    placed.push(
      vertical
        ? { node, x: PAD_X + W + 120, y: LABEL_SPACE + i * (CELL_H + GAP), detached: true }
        : { node, x: PAD_X + i * (W + GAP), y: LABEL_SPACE, detached: true },
    );
  });
  const byAddr = new Map(placed.map((p) => [p.node.addr, p]));

  // Labels: struct roots (accent) and pointer-valued locals (cyan) pointing at nodes.
  const labels = new Map<string, { text: string; root: boolean }[]>();
  const addLabel = (addr: unknown, text: string, root: boolean) => {
    if (typeof addr === 'string' && byAddr.has(addr)) {
      labels.set(addr, [...(labels.get(addr) ?? []), { text, root }]);
    }
  };
  for (const root of ROOTS) {
    addLabel(state[root], root, true);
  }
  for (const [name, value] of Object.entries(step.vars)) {
    if (isPointer(value) && value !== state.self) {
      addLabel(value, name, false);
    }
  }

  const edges: Edge[] = [];
  for (const p of placed) {
    const fromX = p.x + W - PTR_W / 2;
    const fromY = p.y + CELL_H / 2;
    const target = p.node.next ? byAddr.get(p.node.next) : undefined;
    if (target) {
      let d: string;
      if (!vertical && target.y === p.y && target.x > p.x) {
        d = `M ${fromX} ${fromY} C ${fromX + 30} ${fromY}, ${target.x - 30} ${target.y + CELL_H / 2}, ${target.x - 2} ${target.y + CELL_H / 2}`;
      } else if (vertical && target.x === p.x && target.y > p.y) {
        const sx = p.x + W - PTR_W / 2;
        d = `M ${sx} ${p.y + CELL_H} C ${sx} ${p.y + CELL_H + 25}, ${sx} ${target.y - 25}, ${sx} ${target.y - 2}`;
      } else if (!vertical && target.x <= p.x && !p.detached && !target.detached) {
        // Back edge (circular list): route below the chain.
        const below = p.y + CELL_H + 36;
        d = `M ${fromX} ${p.y + CELL_H} C ${fromX} ${below}, ${target.x + 10} ${below}, ${target.x + 10} ${target.y + CELL_H + 2}`;
      } else {
        const tx = vertical ? target.x + W : target.x + W / 2;
        const ty = vertical ? target.y + CELL_H / 2 : target.y + (target.y > p.y ? -2 : CELL_H + 2);
        d = `M ${fromX} ${p.detached ? p.y + CELL_H : fromY} C ${fromX} ${(fromY + ty) / 2 + 10}, ${tx} ${(fromY + ty) / 2 - 10}, ${tx} ${ty}`;
      }
      edges.push({ key: `n${p.node.id}`, d, kind: 'next' });
    }
    if (doubly && p.node.prev) {
      const prev = byAddr.get(p.node.prev);
      if (prev && !p.detached && !prev.detached && prev.x < p.x) {
        edges.push(prevEdge(p, prev, p.y + CELL_H - 7, W));
      } else if (prev) {
        const sx = p.x + PTR_W / 2;
        const tx = prev.x + W / 2;
        const ty = prev.y + (prev.y > p.y ? -2 : CELL_H + 2);
        edges.push({
          key: `p${p.node.id}`,
          d: `M ${sx} ${p.y + CELL_H} C ${sx} ${p.y + CELL_H + 30}, ${tx} ${ty + 30}, ${tx} ${ty}`,
          kind: 'prev',
        });
      }
    }
  }

  const count = Math.max(layout.chain.length, layout.detached.length, 1);
  const width = vertical ? PAD_X * 2 + W * 2 + 140 : PAD_X * 2 + count * (W + GAP);
  const height = vertical
    ? LABEL_SPACE + Math.max(layout.chain.length, layout.detached.length, 1) * (CELL_H + GAP) + 20
    : CHAIN_Y + CELL_H + 70;
  const ease = { duration: animationMs / 1000, ease: [0.4, 0.1, 0.2, 1] as const };

  return (
    <div className="flex h-full w-full flex-col">
      <StructHeader step={step} />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative mx-auto my-4" style={{ width, height }}>
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height}>
            <defs>
              <marker id="av-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L8,4 L0,8 z" fill="var(--color-cyan)" />
              </marker>
              <marker id="av-arrow-prev" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L8,4 L0,8 z" fill="var(--color-st-write)" />
              </marker>
            </defs>
            <AnimatePresence>
              {edges.map((e) => (
                <motion.path
                  key={e.key}
                  initial={{ opacity: 0, d: e.d }}
                  animate={{ opacity: 1, d: e.d }}
                  exit={{ opacity: 0 }}
                  transition={ease}
                  fill="none"
                  stroke={e.kind === 'next' ? 'var(--color-cyan)' : 'var(--color-st-write)'}
                  strokeOpacity={0.85}
                  strokeWidth={1.4}
                  markerEnd={e.kind === 'next' ? 'url(#av-arrow)' : 'url(#av-arrow-prev)'}
                />
              ))}
            </AnimatePresence>
          </svg>
          <AnimatePresence>
            {placed.map((p) => {
              const isNew = step.newIds.includes(p.node.id);
              const freeing = step.freeingId === p.node.id;
              const nodeLabels = labels.get(p.node.addr) ?? [];
              return (
                <motion.div
                  key={p.node.id}
                  className="absolute top-0 left-0"
                  initial={{ opacity: 0, scale: 0.7, x: p.x, y: p.y }}
                  animate={{ opacity: 1, scale: 1, x: p.x, y: p.y }}
                  exit={{ opacity: 0, scale: 0.6, transition: { duration: Math.max(0.15, animationMs / 1000) } }}
                  transition={ease}
                  style={{ width: W }}
                >
                  <div className="absolute -top-[38px] left-0 flex w-full flex-wrap justify-center gap-1">
                    {nodeLabels.map((l) => (
                      <span
                        key={l.text}
                        className={`rounded-sm px-1 font-mono text-[10px] leading-4 ${l.root ? 'bg-accent/15 text-accent' : 'bg-cyan/10 text-cyan'}`}
                      >
                        {l.text}
                      </span>
                    ))}
                  </div>
                  <div className="absolute -top-[17px] left-0 w-full text-center font-mono text-[9.5px] text-faint" title={`${p.node.addr} · ${p.node.size} bytes · malloc at line ${p.node.line}`}>
                    {shortAddr(p.node.addr)}
                  </div>
                  <div
                    className="flex overflow-hidden rounded border font-mono text-[13px] transition-colors"
                    style={{
                      height: CELL_H,
                      borderColor: freeing ? 'var(--color-st-danger)' : isNew ? 'var(--color-st-write)' : 'var(--color-line-strong)',
                      background: freeing ? 'color-mix(in srgb, var(--color-st-danger) 14%, var(--color-panel))' : 'var(--color-panel)',
                      boxShadow: freeing
                        ? '0 0 16px -4px var(--color-st-danger)'
                        : isNew
                          ? '0 0 16px -6px var(--color-st-write)'
                          : undefined,
                    }}
                  >
                    {doubly && (
                      <span className="flex items-center justify-center border-r border-line-strong" style={{ width: PTR_W }}>
                        <PointerCell value={p.node.prev} live={live} label="prev" />
                      </span>
                    )}
                    <span className="flex items-center justify-center text-fg tabular-nums" style={{ width: VALUE_W }}>
                      {p.node.value}
                    </span>
                    <span className="flex items-center justify-center border-l border-line-strong" style={{ width: PTR_W }}>
                      <PointerCell value={p.node.next} live={live} label="next" />
                    </span>
                  </div>
                  <div className="mt-0.5 flex justify-between px-0.5 font-mono text-[9px] text-faint">
                    <span>#{p.node.id}</span>
                    {p.detached && <span className="text-st-write/80">unlinked</span>}
                    {freeing && <span className="text-st-swap">free()</span>}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {placed.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-faint">no heap nodes</div>
          )}
        </div>
      </div>
    </div>
  );
}

function prevEdge(p: Placed, prev: Placed, y: number, W: number): Edge {
  const sx = p.x + PTR_W / 2;
  const tx = prev.x + W - 2;
  return {
    key: `p${p.node.id}`,
    d: `M ${sx} ${y} C ${sx - 25} ${y + 18}, ${tx + 25} ${y + 18}, ${tx} ${y}`,
    kind: 'prev',
  };
}

/** One-line view of the structure struct as it is in memory. */
export function StructHeader({ step }: { step: StructureStep }) {
  const s = step.state;
  const fields: [string, string][] = [];
  for (const key of ['top', 'front', 'rear', 'count', 'head', 'tail', 'size', 'capacity'] as const) {
    const v = s[key];
    if (v === undefined) {
      continue;
    }
    fields.push([key, typeof v === 'string' ? shortAddr(v) : v === null ? 'NULL' : String(v)]);
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-1.5 font-mono text-[11px]">
      <span className="text-faint">struct @ {shortAddr(s.self)}</span>
      <span className="text-muted">{'{'}</span>
      {fields.map(([k, v]) => (
        <span key={k}>
          <span className="text-faint">{k}</span> <span className="text-fg">{v}</span>
        </span>
      ))}
      <span className="text-muted">{'}'}</span>
      {step.allocFailed && <span className="ml-auto rounded-sm border border-st-danger/50 px-1.5 text-st-swap">malloc returned NULL</span>}
    </div>
  );
}
