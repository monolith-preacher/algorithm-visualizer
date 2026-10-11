import type { ArrayStep } from '@av/shared';

export const COLORS = {
  base: 'var(--color-st-base)',
  compare: 'var(--color-st-compare)',
  swap: 'var(--color-st-swap)',
  write: 'var(--color-st-write)',
  read: 'var(--color-st-read)',
  sorted: 'var(--color-st-sorted)',
  pivot: 'var(--color-st-pivot)',
  danger: 'var(--color-st-danger)',
};

export interface CellLook {
  color: string;
  dim: boolean;
  emphasis: boolean;
}

/** Visual state of position i, in priority order. */
export function cellLook(step: ArrayStep, i: number): CellLook {
  const role = step.roles[i];
  const range = step.range;
  const outside = range !== null && (i < range[0] || i > range[1]);
  if (role === 'swap') return { color: COLORS.swap, dim: false, emphasis: true };
  if (role === 'write') return { color: COLORS.write, dim: false, emphasis: true };
  if (role === 'compare') return { color: COLORS.compare, dim: false, emphasis: true };
  if (role === 'read') return { color: COLORS.read, dim: false, emphasis: true };
  if (step.pivot === i) return { color: COLORS.pivot, dim: false, emphasis: false };
  if (step.min === i || step.key === i) return { color: COLORS.read, dim: false, emphasis: false };
  if (step.sorted[i]) return { color: COLORS.sorted, dim: outside, emphasis: false };
  return { color: COLORS.base, dim: outside, emphasis: false };
}

export const LEGEND: { label: string; color: string }[] = [
  { label: 'compare', color: COLORS.compare },
  { label: 'swap', color: COLORS.swap },
  { label: 'write', color: COLORS.write },
  { label: 'read / min / key', color: COLORS.read },
  { label: 'pivot', color: COLORS.pivot },
  { label: 'final position', color: COLORS.sorted },
];

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 font-mono text-[10.5px] text-faint">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
