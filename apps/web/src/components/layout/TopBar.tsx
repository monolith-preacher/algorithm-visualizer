import { NavLink } from 'react-router-dom';

import { cx } from '../../lib/cx';
import type { HealthState } from '../../lib/useHealth';
import { StatusDot } from '../ui/misc';

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="2" y="13" width="4" height="9" rx="1" className="fill-accent" />
      <rect x="8" y="7" width="4" height="15" rx="1" className="fill-cyan" />
      <rect x="14" y="10" width="4" height="12" rx="1" className="fill-accent/70" />
      <rect x="20" y="3" width="2" height="19" rx="1" className="fill-cyan/50" />
    </svg>
  );
}

export function TopBar({ health }: { health: HealthState }) {
  const link = ({ isActive }: { isActive: boolean }) =>
    cx(
      'relative flex h-full items-center px-2 font-mono text-xs tracking-wide whitespace-nowrap transition-colors sm:px-3',
      isActive ? 'text-fg' : 'text-faint hover:text-muted',
    );
  const lab = health.health?.lab;
  const sandbox = health.health?.sandbox;
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:gap-4">
      <NavLink to="/" className="flex items-center gap-2">
        <Logo />
        <span className="hidden font-mono text-[13px] font-semibold tracking-tight sm:inline">
          Algorithm<span className="text-cyan">Visualizer</span>
        </span>
      </NavLink>
      <nav className="flex h-full items-stretch">
        <NavLink to="/lab" className={link}>
          {({ isActive }) => (
            <>
              Algorithm Lab
              {isActive && <span className="absolute inset-x-3 bottom-0 h-px bg-cyan" />}
            </>
          )}
        </NavLink>
        <NavLink to="/playground" className={link}>
          {({ isActive }) => (
            <>
              C Playground
              {isActive && <span className="absolute inset-x-3 bottom-0 h-px bg-cyan" />}
            </>
          )}
        </NavLink>
      </nav>
      <div className="ml-auto hidden items-center gap-4 font-mono text-[11px] text-faint sm:flex">
        <span className="flex items-center gap-1.5" title={health.error ?? lab?.reason ?? 'Instrumented C library built'}>
          <StatusDot ok={Boolean(lab?.available)} pending={health.loading} />
          lab
        </span>
        <span
          className="flex items-center gap-1.5"
          title={health.error ?? sandbox?.reason ?? `Docker sandbox ready (${sandbox?.image ?? ''})`}
        >
          <StatusDot ok={Boolean(sandbox?.available)} pending={health.loading} />
          sandbox
        </span>
        <span className="text-line-strong">|</span>
        <span>gcc · gdb</span>
      </div>
    </header>
  );
}
