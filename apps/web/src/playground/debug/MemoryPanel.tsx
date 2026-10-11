import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

import type { DebugSnapshot, DebugValue, HeapBlock } from '@av/shared';

import { EmptyState } from '../../components/ui/misc';
import { cx } from '../../lib/cx';
import { shortAddr } from '../../lib/format';
import { useSession } from '../session';
import { regionOf } from './values';

interface Arrow {
  key: string;
  d: string;
  dangling: boolean;
}

const hex = (n: bigint) => `0x${n.toString(16)}`;

function range(address: string | null, size: number | undefined): { 'data-start'?: string; 'data-end'?: string } {
  if (!address || !size) {
    return {};
  }
  return { 'data-start': address, 'data-end': hex(BigInt(address) + BigInt(size)) };
}

/** Byte size of each element of an array value, from consecutive element addresses or the total size. */
function elementSize(value: DebugValue): number | undefined {
  const [a, b] = value.children ?? [];
  if (a?.address && b?.address) {
    return Number(BigInt(b.address) - BigInt(a.address));
  }
  if (value.sizeBytes && value.children?.length) {
    return Math.floor(value.sizeBytes / value.children.length);
  }
  return undefined;
}

function PointerValue({ value, snapshot }: { value: DebugValue; snapshot: DebugSnapshot }) {
  if (value.error) {
    return <span className="text-st-swap">{value.value || 'invalid'}</span>;
  }
  if (!value.pointsTo) {
    return <span className="text-faint">NULL</span>;
  }
  const region = regionOf(value.pointsTo, snapshot);
  const literal = value.value.includes('"') ? value.value.slice(value.value.indexOf('"')) : '';
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className="text-cyan">{shortAddr(value.pointsTo)}</span>
      {literal && <span className="max-w-24 truncate text-accent">{literal}</span>}
      {region && region !== 'heap' && region !== 'stack' && <span className="text-[10px] text-faint">{region}</span>}
      <span data-ptr={value.pointsTo} className="inline-block h-2 w-2 shrink-0 rounded-full border border-cyan bg-cyan/40" />
    </span>
  );
}

function Cells({ value, snapshot }: { value: DebugValue; snapshot: DebugSnapshot }) {
  const size = elementSize(value);
  return (
    <div className="flex flex-wrap gap-px pt-0.5 pb-1">
      {value.children?.map((cell, i) => (
        <div
          key={cell.expression}
          {...range(cell.address, size)}
          className="flex min-w-9 flex-col items-center rounded-[3px] border border-line-strong bg-surface px-1 py-0.5"
          title={`${cell.expression}${cell.address ? ` @ ${cell.address}` : ''}`}
        >
          <span className="font-mono text-[9px] text-faint">{i}</span>
          <span className="font-mono text-[11px] text-fg">
            {cell.kind === 'pointer' ? <PointerValue value={cell} snapshot={snapshot} /> : cell.kind === 'struct' ? '{…}' : cell.value}
          </span>
        </div>
      ))}
      {value.truncated && <span className="self-center px-1 font-mono text-[10px] text-faint">…</span>}
    </div>
  );
}

function Row({ value, snapshot, depth, top }: { value: DebugValue; snapshot: DebugSnapshot; depth: number; top: boolean }) {
  const charArray = value.kind === 'array' && /char/.test(value.type);
  const attrs = top ? range(value.address, value.sizeBytes) : {};
  return (
    <div {...attrs} className={cx('rounded-sm', top && 'border-b border-line last:border-b-0')}>
      <div className="flex items-baseline gap-2 px-2 py-[3px] font-mono text-[11.5px]" style={{ paddingLeft: 8 + depth * 12 }}>
        <span className="text-muted">{value.name}</span>
        <span className="truncate text-[10px] text-faint">{value.type}</span>
        {top && value.address && <span className="ml-auto shrink-0 text-[9.5px] text-faint">{shortAddr(value.address)}</span>}
        <span className={cx('shrink-0 text-right', !(top && value.address) && 'ml-auto')}>
          {value.kind === 'pointer' ? (
            <PointerValue value={value} snapshot={snapshot} />
          ) : value.kind === 'scalar' || charArray || value.kind === 'function' ? (
            <span className="text-fg">{value.value}</span>
          ) : null}
        </span>
      </div>
      {value.kind === 'array' && !charArray && (
        <div style={{ paddingLeft: 8 + depth * 12 }} className="pr-2">
          <Cells value={value} snapshot={snapshot} />
        </div>
      )}
      {value.kind === 'struct' &&
        value.children?.map((field) => <Row key={field.expression} value={field} snapshot={snapshot} depth={depth + 1} top={false} />)}
    </div>
  );
}

function Card({ title, subtitle, children, tone = 'default', ...rest }: { title: string; subtitle?: string; children: ReactNode; tone?: 'default' | 'active' | 'freed' } & Record<string, unknown>) {
  return (
    <div
      {...rest}
      className={cx(
        'overflow-hidden rounded border bg-panel',
        tone === 'active' ? 'border-cyan-dim' : tone === 'freed' ? 'border-dashed border-st-danger/50 opacity-70' : 'border-line-strong',
      )}
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-line bg-raised/60 px-2 py-1 font-mono text-[11px]">
        <span className={tone === 'active' ? 'text-cyan' : tone === 'freed' ? 'text-st-swap' : 'text-fg'}>{title}</span>
        {subtitle && <span className="text-[10px] text-faint">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function referenced(block: HeapBlock, snapshot: DebugSnapshot): boolean {
  const start = BigInt(block.address);
  const end = start + BigInt(block.size);
  const visit = (v: DebugValue): boolean => {
    if (v.kind === 'pointer' && v.pointsTo) {
      const p = BigInt(v.pointsTo);
      if (p >= start && p < end) {
        return true;
      }
    }
    return v.children?.some(visit) ?? false;
  };
  const roots = [...snapshot.globals, ...snapshot.frames.flatMap((f) => [...f.args, ...f.locals])];
  return roots.some(visit) || snapshot.heap.some((b) => b !== block && b.view !== undefined && visit(b.view));
}

/** Draws pointer arrows from [data-ptr] dots to the most specific [data-start, data-end) element. */
function useArrows(container: RefObject<HTMLDivElement | null>, snapshot: DebugSnapshot | null): Arrow[] {
  const [arrows, setArrows] = useState<Arrow[]>([]);
  useLayoutEffect(() => {
    const root = container.current;
    if (!root || !snapshot) {
      return;
    }
    const compute = () => {
      const origin = root.getBoundingClientRect();
      const offset = (r: DOMRect) => ({
        left: r.left - origin.left + root.scrollLeft,
        top: r.top - origin.top + root.scrollTop,
        right: r.right - origin.left + root.scrollLeft,
        bottom: r.bottom - origin.top + root.scrollTop,
      });
      const targets = [...root.querySelectorAll<HTMLElement>('[data-start]')].map((el) => ({
        el,
        start: BigInt(el.dataset['start'] ?? '0'),
        end: BigInt(el.dataset['end'] ?? '0'),
      }));
      const next: Arrow[] = [];
      root.querySelectorAll<HTMLElement>('[data-ptr]').forEach((src, i) => {
        const ptr = BigInt(src.dataset['ptr'] ?? '0');
        const candidates = targets.filter((t) => ptr >= t.start && ptr < t.end && !t.el.contains(src));
        candidates.sort((a, b) => Number(a.end - a.start - (b.end - b.start)));
        const target = candidates[0];
        if (!target) {
          return;
        }
        const s = offset(src.getBoundingClientRect());
        const t = offset(target.el.getBoundingClientRect());
        const sx = s.right - 3;
        const sy = (s.top + s.bottom) / 2;
        const toLeft = t.left > sx - 20;
        const tx = toLeft ? t.left : t.right;
        const ty = Math.min(Math.max(sy, t.top + 8), t.bottom - 8);
        const bend = Math.max(40, Math.abs(tx - sx) / 2);
        const d = toLeft
          ? `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`
          : `M ${sx} ${sy} C ${sx + 30} ${sy}, ${tx + 30} ${ty}, ${tx + 2} ${ty}`;
        next.push({ key: `${i}`, d, dangling: target.el.dataset['freed'] === '1' });
      });
      setArrows(next);
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(root);
    root.querySelectorAll('[data-observe]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [container, snapshot]);
  return snapshot ? arrows : [];
}

/**
 * Stack frames and heap blocks of the paused program. Heap blocks come from
 * the allocation tracker linked into debug builds; a block is typed only when
 * a typed pointer in the program refers to it.
 */
export function MemoryPanel() {
  const snapshot = useSession((s) => s.snapshot);
  const container = useRef<HTMLDivElement>(null);
  const arrows = useArrows(container, snapshot);
  if (!snapshot) {
    return <EmptyState title="no paused program">The memory view shows stack frames, heap blocks and pointers of the paused program.</EmptyState>;
  }
  const frames = snapshot.frames.filter((f) => f.user);
  const live = snapshot.heap.filter((b) => b.state === 'live');
  const freed = snapshot.heap.filter((b) => b.state === 'freed');

  return (
    <div ref={container} className="@container relative h-full overflow-auto">
      <div data-observe className="grid grid-cols-1 gap-x-14 gap-y-5 py-3 pr-10 pl-3 @[640px]:grid-cols-2 @[640px]:pr-3">
        <div className="flex flex-col gap-2">
          <div className="panel-title">Stack</div>
          {frames.map((frame, i) => (
            <Card key={frame.level} title={`${frame.func}()`} subtitle={`frame #${frame.level} · line ${frame.line}`} tone={i === 0 ? 'active' : 'default'}>
              {[...frame.args, ...frame.locals].map((v) => (
                <Row key={v.expression} value={v} snapshot={snapshot} depth={0} top />
              ))}
              {frame.args.length + frame.locals.length === 0 && <div className="px-2 py-1 font-mono text-[11px] text-faint">no locals</div>}
            </Card>
          ))}
          {snapshot.globals.length > 0 && (
            <>
              <div className="panel-title mt-2">Globals · data / bss</div>
              <Card title="main.c">
                {snapshot.globals.map((v) => (
                  <Row key={v.expression} value={v} snapshot={snapshot} depth={0} top />
                ))}
              </Card>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="panel-title">
            Heap · {live.length} live block{live.length === 1 ? '' : 's'}
          </div>
          {!snapshot.heapTracking.available && (
            <div className="font-mono text-[11px] text-faint">Allocation tracking unavailable for this build.</div>
          )}
          {snapshot.heapTracking.overflow && (
            <div className="font-mono text-[11px] text-st-compare">Allocation table full: later blocks are not tracked.</div>
          )}
          {live.length === 0 && snapshot.heapTracking.available && <div className="font-mono text-[11px] text-faint">no live allocations</div>}
          {live.map((block) => {
            const isReferenced = referenced(block, snapshot);
            return (
              <Card
                key={block.address}
                title={shortAddr(block.address)}
                subtitle={`${block.size} B${isReferenced ? '' : ' · no pointer to it in scope'}`}
                {...range(block.address, block.size)}
              >
                {block.view ? (
                  block.view.kind === 'array' ? (
                    <div className="px-2">
                      <div className="pt-1 font-mono text-[10px] text-faint">{block.view.type}</div>
                      <Cells value={block.view} snapshot={snapshot} />
                    </div>
                  ) : block.view.kind === 'struct' ? (
                    <>
                      <div className="px-2 pt-1 font-mono text-[10px] text-faint">{block.view.type}</div>
                      {block.view.children?.map((field) => (
                        <Row key={field.expression} value={field} snapshot={snapshot} depth={0} top={false} />
                      ))}
                    </>
                  ) : (
                    <Row value={{ ...block.view, name: '*' }} snapshot={snapshot} depth={0} top={false} />
                  )
                ) : (
                  <div className="px-2 py-1 font-mono text-[11px] text-faint">untyped (no typed pointer refers to its start)</div>
                )}
              </Card>
            );
          })}
          {freed.length > 0 && (
            <>
              <div className="panel-title mt-2">Freed blocks</div>
              {freed.map((block) => (
                <Card key={block.address} title={shortAddr(block.address)} subtitle={`${block.size} B · freed`} tone="freed" data-freed="1" {...range(block.address, block.size)}>
                  <div className="px-2 py-1 font-mono text-[10.5px] text-faint">released with free()</div>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
      <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1}>
        <defs>
          <marker id="mem-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--color-cyan)" />
          </marker>
          <marker id="mem-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--color-st-danger)" />
          </marker>
        </defs>
        {arrows.map((a) => (
          <path
            key={a.key}
            d={a.d}
            fill="none"
            stroke={a.dangling ? 'var(--color-st-danger)' : 'var(--color-cyan)'}
            strokeOpacity={0.75}
            strokeWidth={1.3}
            strokeDasharray={a.dangling ? '4 3' : undefined}
            markerEnd={a.dangling ? 'url(#mem-arrow-bad)' : 'url(#mem-arrow)'}
          />
        ))}
      </svg>
    </div>
  );
}
