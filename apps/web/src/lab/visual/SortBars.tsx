import { useMemo } from 'react';

import type { ArrayStep } from '@av/shared';

import { cellLook, COLORS } from './colors';
import { indexMarkers, type IndexMarker } from './indexMarkers';

interface SortBarsProps {
  algorithm: string;
  step: ArrayStep;
  animationMs: number;
  /** Largest value of the input (keeps the scale fixed during the run). */
  max: number;
  compact?: boolean;
}

function Markers({ markers, n }: { markers: IndexMarker[]; n: number }) {
  const byIndex = new Map<number, string[]>();
  for (const m of markers) {
    byIndex.set(m.index, [...(byIndex.get(m.index) ?? []), m.name]);
  }
  // Labels of nearby indices alternate between two rows so they never overlap.
  const groups = [...byIndex].sort((a, b) => a[0] - b[0]);
  const near = Math.max(2, Math.ceil(n / 12));
  const placed: { index: number; names: string[]; row: number }[] = [];
  for (const [index, names] of groups) {
    const prev = placed[placed.length - 1];
    placed.push({ index, names, row: prev && index - prev.index <= near ? 1 - prev.row : 0 });
  }
  return (
    <div className="relative h-8">
      {placed.map(({ index, names, row: r }) => (
        <span
          key={index}
          className="absolute -translate-x-1/2 font-mono text-[10px] leading-4 whitespace-nowrap text-cyan transition-[left] duration-150"
          style={{ left: `${((index + 0.5) / n) * 100}%`, top: r * 15 }}
        >
          ▲{names.join(',')}
        </span>
      ))}
    </div>
  );
}

/** Vertical bars whose height is the element value; bars keep their identity across swaps. */
export function SortBars({ algorithm, step, animationMs, max, compact }: SortBarsProps) {
  const n = step.values.length;
  const showValues = n <= (compact ? 24 : 40);
  const showIndices = n <= 50 && !compact;
  const scale = Math.max(max, ...step.values, 1);
  const positions = useMemo(() => {
    const pos = new Map<number, number>();
    step.ids.forEach((id, i) => pos.set(id, i));
    return pos;
  }, [step.ids]);
  const ids = useMemo(() => [...step.ids].sort((a, b) => a - b), [step.ids]);
  const top = step.frames[step.frames.length - 1];
  const markers = compact ? [] : indexMarkers(algorithm, top?.vars, n);
  const auxMarkers = compact || !step.aux ? [] : indexMarkers(algorithm, top?.vars, step.aux.length, 'aux');
  const gap = n > 60 ? 1 : 2;
  const transition = `left ${animationMs}ms cubic-bezier(.4,.1,.2,1), height ${animationMs}ms ease-out, background-color ${Math.min(animationMs, 150)}ms linear, opacity ${animationMs}ms`;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className={`relative min-h-0 ${step.aux ? 'flex-[3]' : 'flex-1'}`}>
        {step.reference && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-st-compare/70 transition-[bottom]"
            style={{ bottom: `${(step.reference.value / scale) * 100}%`, transitionDuration: `${animationMs}ms` }}
          >
            <span className="absolute -top-4 right-0 rounded-sm bg-bg/80 px-1 font-mono text-[10px] text-st-compare">
              {step.reference.expr} = {step.reference.value}
            </span>
          </div>
        )}
        {ids.map((id) => {
          const i = positions.get(id) ?? 0;
          const value = step.values[i] ?? 0;
          const look = cellLook(step, i);
          return (
            <div
              key={id}
              className="absolute bottom-0 flex flex-col items-center justify-start"
              style={{
                left: `calc(${(i / n) * 100}% + ${gap / 2}px)`,
                width: `calc(${100 / n}% - ${gap}px)`,
                height: `${Math.max(1.5, (value / scale) * 100)}%`,
                transition,
              }}
            >
              <div
                className="h-full w-full rounded-t-[2px]"
                style={{
                  backgroundColor: look.color,
                  opacity: look.dim ? 0.28 : 1,
                  boxShadow: look.emphasis ? `0 0 12px -2px ${look.color}` : undefined,
                  transition,
                }}
              />
              {showValues && (
                <span
                  className="absolute -top-4 font-mono text-[10px] leading-4 tabular-nums"
                  style={{ color: look.emphasis ? look.color : 'var(--color-muted)', opacity: look.dim ? 0.4 : 1 }}
                >
                  {value}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 border-t border-line-strong" />
      {showIndices && (
        <div className="relative h-4">
          {step.values.map((_, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 font-mono text-[9px] leading-4 text-faint tabular-nums"
              style={{ left: `${((i + 0.5) / n) * 100}%` }}
            >
              {i}
            </span>
          ))}
        </div>
      )}
      {step.range && !compact && (
        <div className="relative h-2">
          <div
            className="absolute top-0.5 h-1.5 rounded-b-sm border border-t-0 border-cyan/60 transition-all"
            style={{
              left: `${(step.range[0] / n) * 100}%`,
              width: `${((step.range[1] - step.range[0] + 1) / n) * 100}%`,
              transitionDuration: `${animationMs}ms`,
            }}
          />
        </div>
      )}
      {markers.length > 0 && <Markers markers={markers} n={n} />}
      {step.aux && (
        <div className="mt-3 flex min-h-0 flex-[1.3] flex-col">
          <span className="font-mono text-[10px] tracking-wider text-faint">aux</span>
          <div className="relative min-h-0 flex-1 border-b border-line-strong">
            {step.aux.map((value, i) => {
              const role = step.auxRoles[i];
              const color = role === 'compare' ? COLORS.compare : role === 'read' ? COLORS.read : role === 'write' ? COLORS.write : '#2c3a4c';
              return (
                <div
                  key={i}
                  className="absolute bottom-0 rounded-t-[2px]"
                  style={{
                    left: `calc(${(i / n) * 100}% + ${gap / 2}px)`,
                    width: `calc(${100 / n}% - ${gap}px)`,
                    height: value === null ? '0%' : `${Math.max(1.5, (value / scale) * 100)}%`,
                    backgroundColor: color,
                    boxShadow: role ? `0 0 10px -2px ${color}` : undefined,
                    transition,
                  }}
                />
              );
            })}
          </div>
          {auxMarkers.length > 0 && <Markers markers={auxMarkers} n={n} />}
        </div>
      )}
    </div>
  );
}
