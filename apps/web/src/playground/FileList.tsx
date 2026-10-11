import { FilePlus2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { IconButton } from '../components/ui/Button';
import { PanelHeader } from '../components/ui/misc';
import { cx } from '../lib/cx';
import { disposeModel } from './CodeEditor';
import { useFiles } from './files';

/** Programs saved in this browser. */
export function FileList({ disabled }: { disabled: boolean }) {
  const files = useFiles((s) => s.files);
  const activeId = useFiles((s) => s.activeId);
  const select = useFiles((s) => s.select);
  const create = useFiles((s) => s.create);
  const remove = useFiles((s) => s.remove);
  const rename = useFiles((s) => s.rename);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <PanelHeader title="Programs">
        <IconButton label="New program" onClick={() => create()} disabled={disabled} className="h-6 w-6">
          <FilePlus2 size={12} />
        </IconButton>
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {files.map((file) => (
          <div
            key={file.id}
            className={cx(
              'group flex items-center gap-1 border-l py-0.5 pr-1 pl-3',
              file.id === activeId ? 'border-cyan bg-cyan/5' : 'border-transparent hover:bg-hover',
            )}
          >
            {editing === file.id ? (
              <input
                autoFocus
                defaultValue={file.name}
                className="input h-6 min-w-0 flex-1"
                onBlur={(e) => {
                  rename(file.id, e.target.value);
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setEditing(null);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => select(file.id)}
                onDoubleClick={() => setEditing(file.id)}
                title="Double-click to rename"
                className={cx('min-w-0 flex-1 truncate py-1 text-left font-mono text-xs', file.id === activeId ? 'text-fg' : 'text-muted')}
              >
                {file.name}
              </button>
            )}
            <button
              type="button"
              aria-label={`Delete ${file.name}`}
              title="Delete"
              disabled={disabled}
              onClick={() => {
                if (window.confirm(`Delete ${file.name}? This cannot be undone.`)) {
                  disposeModel(file.id);
                  remove(file.id);
                }
              }}
              className="invisible p-1 text-faint group-hover:visible hover:text-st-swap"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-3 py-2 text-[10.5px] leading-relaxed text-faint">Saved in this browser (localStorage).</div>
    </div>
  );
}
