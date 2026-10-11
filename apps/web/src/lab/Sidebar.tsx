import { GitCompareArrows } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { algorithmsOf, MODULES } from '@av/shared';

import { cx } from '../lib/cx';

const item = ({ isActive }: { isActive: boolean }) =>
  cx(
    'flex items-center gap-2 border-l py-1 pr-2 pl-4 font-mono text-[12px] transition-colors',
    isActive ? 'border-cyan bg-cyan/5 text-fg' : 'border-transparent text-muted hover:bg-hover hover:text-fg',
  );

export function Sidebar() {
  return (
    <nav className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface py-3">
      {MODULES.map((module) => (
        <div key={module.id} className="mb-3">
          <div className="px-4 pb-1.5 panel-title" title={module.description}>
            {module.name}
          </div>
          {algorithmsOf(module.id).map((a) => (
            <NavLink key={a.id} to={`/lab/${module.id}/${a.id}`} className={item}>
              {a.name}
            </NavLink>
          ))}
          {module.id === 'sorting' && (
            <NavLink to="/lab/sorting/compare" className={item}>
              <GitCompareArrows size={12} className="text-cyan" />
              Compare
            </NavLink>
          )}
        </div>
      ))}
    </nav>
  );
}

/** Compact selector replacing the sidebar on small screens. */
export function MobileNav({ value, onChange }: { value: string; onChange: (path: string) => void }) {
  return (
    <div className="border-b border-line bg-surface px-3 py-2">
      <select className="input w-full" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Algorithm">
        {MODULES.map((module) => (
          <optgroup key={module.id} label={module.name}>
            {algorithmsOf(module.id).map((a) => (
              <option key={a.id} value={`/lab/${module.id}/${a.id}`}>
                {a.name}
              </option>
            ))}
            {module.id === 'sorting' && <option value="/lab/sorting/compare">Compare sorting algorithms</option>}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
