import type { ReactNode } from 'react';

import { cx } from '../../lib/cx';

export function Badge({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'accent' | 'cyan' | 'warn' | 'danger'; className?: string }) {
  const tones = {
    default: 'border-line-strong text-muted',
    accent: 'border-accent-dim/70 text-accent',
    cyan: 'border-cyan-dim/70 text-cyan',
    warn: 'border-st-compare/40 text-st-compare',
    danger: 'border-st-danger/50 text-st-swap',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[10.5px] leading-4 whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-sm border border-line-strong bg-raised px-1 font-mono text-[10px] text-muted">{children}</kbd>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx('inline-block h-3 w-3 animate-spin rounded-full border border-cyan/30 border-t-cyan', className)}
      aria-label="Loading"
    />
  );
}

export function StatusDot({ ok, pending }: { ok: boolean; pending?: boolean }) {
  return (
    <span
      className={cx(
        'inline-block h-1.5 w-1.5 rounded-full',
        pending ? 'animate-pulse-soft bg-st-compare' : ok ? 'bg-accent shadow-[0_0_6px] shadow-accent/60' : 'bg-st-danger',
      )}
    />
  );
}

export function PanelHeader({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex h-8 shrink-0 items-center justify-between gap-2 border-b border-line px-3', className)}>
      <span className="panel-title truncate">{title}</span>
      {children && <div className="flex items-center gap-1">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-2 p-6 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <div className="font-mono text-xs text-muted">{title}</div>
      {children && <div className="max-w-sm text-xs leading-relaxed text-faint">{children}</div>}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-st-danger/40 bg-st-danger/5 px-3 py-2 font-mono text-xs leading-relaxed text-st-swap">
      {children}
    </div>
  );
}

interface TabsProps<T extends string> {
  tabs: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cx('flex items-stretch gap-0.5', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
          className={cx(
            'relative flex items-center gap-1.5 px-2.5 font-mono text-[11px] tracking-wide transition-colors',
            tab.id === value ? 'text-fg' : 'text-faint hover:text-muted',
          )}
        >
          {tab.label}
          {tab.id === value && <span className="absolute inset-x-1.5 bottom-0 h-px bg-cyan" />}
        </button>
      ))}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="inline-flex h-7 rounded border border-line-strong bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-sm px-2 font-mono text-[11px] transition-colors',
            o.value === value ? 'bg-raised text-fg' : 'text-faint hover:text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, title }: { checked: boolean; onChange: (v: boolean) => void; label: string; title?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted select-none" title={title}>
      <span
        className={cx(
          'relative inline-block h-3.5 w-6 rounded-full border transition-colors',
          checked ? 'border-accent-dim bg-accent/25' : 'border-line-strong bg-surface',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-2 w-2 rounded-full transition-all',
            checked ? 'left-3 bg-accent' : 'left-0.5 bg-faint',
          )}
        />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
