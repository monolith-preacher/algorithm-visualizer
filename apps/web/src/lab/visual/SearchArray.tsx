import type { ArrayStep } from '@av/shared';

import { cx } from '../../lib/cx';
import { COLORS } from './colors';
import { indexMarkers } from './indexMarkers';

interface SearchArrayProps {
  algorithm: string;
  step: ArrayStep;
  target: number | null;
  animationMs: number;
}

/** Array cells for searching: probed cell, live interval, discarded and visited cells, match. */
export function SearchArray({ algorithm, step, target, animationMs }: SearchArrayProps) {
  const n = step.values.length;
  const top = step.frames[step.frames.length - 1];
  const markers = indexMarkers(algorithm, top?.vars, n);
  const binary = algorithm === 'binary-search';
  const cell = n > 40 ? 30 : 40;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-x-auto px-4 py-6">
      <div className="flex items-center gap-4 font-mono text-xs">
        <span className="text-faint">
          target <span className="text-st-compare">{target ?? '—'}</span>
        </span>
        {step.found !== null && (
          <span className="rounded-sm border border-accent-dim px-1.5 py-px text-accent">found · index {step.found}</span>
        )}
        {step.notFound && <span className="rounded-sm border border-st-danger/50 px-1.5 py-px text-st-swap">not found · returns -1</span>}
      </div>
      <div className="flex flex-col items-start">
        <div className="flex">
          {step.values.map((value, i) => {
            const role = step.roles[i];
            const discarded = binary && step.range !== null && (i < step.range[0] || i > step.range[1]);
            const visited = !binary && step.visited[i] && role !== 'compare';
            const found = step.found === i;
            const color = found ? COLORS.sorted : role === 'compare' ? COLORS.compare : null;
            return (
              <div key={i} className="flex flex-col items-center" style={{ width: cell }}>
                <div
                  className={cx(
                    'flex items-center justify-center border font-mono text-[13px] tabular-nums',
                    i === 0 ? 'rounded-l' : '',
                    i === n - 1 ? 'rounded-r' : '',
                  )}
                  style={{
                    width: cell,
                    height: cell,
                    marginLeft: i === 0 ? 0 : -1,
                    borderColor: color ?? 'var(--color-line-strong)',
                    background: color ? `color-mix(in srgb, ${color} 18%, transparent)` : 'var(--color-panel)',
                    color: color ?? 'var(--color-fg)',
                    opacity: discarded ? 0.22 : visited ? 0.45 : 1,
                    boxShadow: color ? `0 0 14px -4px ${color}` : undefined,
                    zIndex: color ? 1 : 0,
                    transition: `all ${animationMs}ms ease-out`,
                  }}
                >
                  {value}
                </div>
                <span className="mt-1 font-mono text-[9.5px] text-faint tabular-nums">{i}</span>
              </div>
            );
          })}
        </div>
        <div className="relative mt-1 h-10 w-full">
          {markers.map((m, k) => (
            <span
              key={m.name}
              className="absolute flex -translate-x-1/2 flex-col items-center font-mono text-[10.5px] text-cyan transition-[left]"
              style={{ left: (m.index + 0.5) * cell - (m.index > 0 ? m.index : 0), top: k * 12, transitionDuration: `${animationMs}ms` }}
            >
              <span className="leading-3">▲ {m.name}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
