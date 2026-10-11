import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  default: 'border-line-strong bg-raised text-fg hover:bg-hover hover:border-faint',
  primary: 'border-accent-dim bg-accent/10 text-accent hover:bg-accent/20',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-hover hover:text-fg',
  danger: 'border-st-danger/40 bg-st-danger/10 text-st-swap hover:bg-st-danger/20',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  size?: 'sm' | 'md';
}

export function Button({ variant = 'default', icon, size = 'md', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded border font-mono font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  tone?: 'default' | 'accent' | 'danger';
}

export function IconButton({ label, active, tone = 'default', className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors disabled:pointer-events-none disabled:opacity-35',
        active
          ? 'border-cyan-dim bg-cyan/10 text-cyan'
          : tone === 'accent'
            ? 'border-line-strong bg-raised text-accent hover:bg-hover'
            : tone === 'danger'
              ? 'border-line-strong bg-raised text-st-swap hover:bg-hover'
              : 'border-line-strong bg-raised text-muted hover:bg-hover hover:text-fg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
