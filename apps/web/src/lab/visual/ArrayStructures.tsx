import type { StructureStep } from '@av/shared';

import { cx } from '../../lib/cx';
import { StructHeader } from './LinkedNodes';

const CELL = 46;

function changed(step: StructureStep, prev: StructureStep | undefined, i: number): boolean {
  return prev !== undefined && prev.state.items?.[i] !== step.state.items?.[i];
}

function Cell({
  value,
  active,
  highlight,
  label,
  className,
}: {
  value: number | undefined;
  active: boolean;
  highlight: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cx('relative flex items-center justify-center border font-mono text-[13px] tabular-nums transition-all duration-200', className)}
      style={{
        width: CELL,
        height: CELL - 8,
        borderColor: highlight ? 'var(--color-st-write)' : active ? 'var(--color-cyan-dim)' : 'var(--color-line)',
        background: highlight
          ? 'color-mix(in srgb, var(--color-st-write) 16%, var(--color-panel))'
          : active
            ? 'color-mix(in srgb, var(--color-cyan) 8%, var(--color-panel))'
            : 'var(--color-surface)',
        color: active || highlight ? 'var(--color-fg)' : 'var(--color-faint)',
        boxShadow: highlight ? '0 0 14px -5px var(--color-st-write)' : undefined,
      }}
      title={active ? undefined : 'Slot outside the live region: the value is whatever is left in memory'}
    >
      {value}
      {label && <span className="absolute -bottom-4 font-mono text-[9px] text-faint">{label}</span>}
    </div>
  );
}

/** items[0..capacity-1] drawn bottom-up; top indexes the last element (-1 when empty). */
export function ArrayStackView({ step, prev }: { step: StructureStep; prev?: StructureStep }) {
  const { items = [], capacity = items.length } = step.state;
  const top = typeof step.state.top === 'number' ? step.state.top : -1;
  const slots = Array.from({ length: capacity }, (_, i) => capacity - 1 - i);
  return (
    <div className="flex h-full w-full flex-col">
      <StructHeader step={step} />
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        <div className="flex flex-col">
          {slots.map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className={cx('w-16 text-right font-mono text-[11px] transition-colors', i === top ? 'text-accent' : 'text-transparent')}>
                top ▶
              </span>
              <Cell value={items[i]} active={i <= top} highlight={changed(step, prev, i)} className="-mt-px" />
              <span className="w-8 font-mono text-[10px] text-faint">[{i}]</span>
            </div>
          ))}
          <div className={cx('mt-2 ml-[76px] font-mono text-[11px]', top === -1 ? 'text-accent' : 'text-faint')}>
            top = {top}
            {top === -1 && ' (empty)'}
            {top === capacity - 1 && <span className="text-st-compare"> (full)</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function IndexMarker({ index, name, row }: { index: number; name: string; row: number }) {
  return (
    <span
      className="absolute flex -translate-x-1/2 flex-col items-center font-mono text-[10.5px] text-accent transition-[left] duration-300"
      style={{ left: index * (CELL - 1) + CELL / 2, top: row * 14 }}
    >
      ▲ {name}
    </span>
  );
}

/** Linear queue: [front, rear) is live; slots before front are never reused. */
export function ArrayQueueView({ step, prev }: { step: StructureStep; prev?: StructureStep }) {
  const { items = [], capacity = items.length } = step.state;
  const front = typeof step.state.front === 'number' ? step.state.front : 0;
  const rear = typeof step.state.rear === 'number' ? step.state.rear : 0;
  return (
    <div className="flex h-full w-full flex-col">
      <StructHeader step={step} />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-auto p-6">
        <div className="flex">
          {items.slice(0, capacity).map((value, i) => (
            <div key={i} className="flex flex-col items-center" style={{ marginLeft: i === 0 ? 0 : -1 }}>
              <Cell
                value={value}
                active={i >= front && i < rear}
                highlight={changed(step, prev, i)}
                className={i < front ? 'bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--color-line)_4px_5px)]' : ''}
              />
              <span className="mt-1 font-mono text-[9.5px] text-faint">{i}</span>
            </div>
          ))}
        </div>
        <div className="relative h-8" style={{ width: capacity * (CELL - 1) + 1 }}>
          <IndexMarker index={Math.min(front, capacity - 0.5)} name="front" row={0} />
          <IndexMarker index={Math.min(rear, capacity - 0.5)} name={rear >= capacity ? 'rear (= capacity)' : 'rear'} row={front === rear ? 1 : 0} />
        </div>
        {front > 0 && (
          <div className="font-mono text-[10.5px] text-faint">
            {front} slot{front > 1 ? 's' : ''} before front cannot be reused
          </div>
        )}
      </div>
    </div>
  );
}

/** Ring buffer drawn as a circle, plus the underlying array. */
export function CircularQueueView({ step, prev }: { step: StructureStep; prev?: StructureStep }) {
  const { items = [], capacity = items.length } = step.state;
  const front = typeof step.state.front === 'number' ? step.state.front : 0;
  const rear = typeof step.state.rear === 'number' ? step.state.rear : 0;
  const count = step.state.count ?? 0;
  const occupied = (i: number) => (i - front + capacity) % capacity < count;
  const R = 92;
  const C = 130;
  const angle = (i: number) => (i / capacity) * Math.PI * 2 - Math.PI / 2;
  const sector = (i: number) => {
    const a0 = angle(i) - Math.PI / capacity + 0.03;
    const a1 = angle(i) + Math.PI / capacity - 0.03;
    const r0 = R - 26;
    const r1 = R + 26;
    const p = (r: number, a: number) => `${C + r * Math.cos(a)} ${C + r * Math.sin(a)}`;
    return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
  };
  const marker = (i: number, label: string, offset: number) => {
    const a = angle(i);
    const r = R + 36 + offset;
    return (
      <g style={{ transition: 'transform 300ms' }}>
        <line x1={C + (R + 28) * Math.cos(a)} y1={C + (R + 28) * Math.sin(a)} x2={C + r * Math.cos(a)} y2={C + r * Math.sin(a)} stroke="var(--color-accent)" strokeWidth={1.2} />
        <text x={C + (r + 12) * Math.cos(a)} y={C + (r + 12) * Math.sin(a) + 4} textAnchor="middle" className="font-mono" fontSize={10.5} fill="var(--color-accent)">
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="flex h-full w-full flex-col">
      <StructHeader step={step} />
      <div className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-8 overflow-auto p-4">
        <svg viewBox="-50 -50 360 360" className="h-72 w-72 shrink-0">
          {Array.from({ length: capacity }, (_, i) => {
            const on = occupied(i);
            const hit = changed(step, prev, i);
            const a = angle(i);
            return (
              <g key={i}>
                <path
                  d={sector(i)}
                  fill={hit ? 'color-mix(in srgb, var(--color-st-write) 22%, var(--color-panel))' : on ? 'color-mix(in srgb, var(--color-cyan) 12%, var(--color-panel))' : 'var(--color-surface)'}
                  stroke={hit ? 'var(--color-st-write)' : on ? 'var(--color-cyan-dim)' : 'var(--color-line)'}
                  style={{ transition: 'fill 200ms, stroke 200ms' }}
                />
                <text x={C + R * Math.cos(a)} y={C + R * Math.sin(a) + 4} textAnchor="middle" className="font-mono" fontSize={13} fill={on ? 'var(--color-fg)' : 'var(--color-faint)'}>
                  {items[i]}
                </text>
                <text x={C + (R - 40) * Math.cos(a)} y={C + (R - 40) * Math.sin(a) + 3} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--color-faint)">
                  {i}
                </text>
              </g>
            );
          })}
          <text x={C} y={C - 2} textAnchor="middle" className="font-mono" fontSize={11} fill="var(--color-muted)">
            count {count}/{capacity}
          </text>
          <text x={C} y={C + 13} textAnchor="middle" className="font-mono" fontSize={9.5} fill="var(--color-faint)">
            (rear + 1) % {capacity}
          </text>
          {front === rear ? marker(front, 'front = rear', 0) : (
            <>
              {marker(front, 'front', 0)}
              {marker(rear, 'rear', 0)}
            </>
          )}
        </svg>
        <div className="flex flex-col items-center gap-1">
          <div className="flex">
            {items.slice(0, capacity).map((value, i) => (
              <div key={i} className="flex flex-col items-center" style={{ marginLeft: i === 0 ? 0 : -1 }}>
                <Cell value={value} active={occupied(i)} highlight={changed(step, prev, i)} />
                <span className="mt-1 font-mono text-[9.5px] text-faint">{i}</span>
              </div>
            ))}
          </div>
          <div className="relative h-8" style={{ width: capacity * (CELL - 1) + 1 }}>
            <IndexMarker index={front} name="front" row={0} />
            <IndexMarker index={rear} name="rear" row={front === rear ? 1 : 0} />
          </div>
        </div>
      </div>
    </div>
  );
}
