import { Dices, Pencil } from 'lucide-react';
import { useState } from 'react';

import type { InputSpec } from '@av/shared';

import { Button } from '../../components/ui/Button';
import { cx } from '../../lib/cx';
import { generate, parseValues, PRESETS, type Preset } from '../data/generate';

interface ArrayInputProps {
  spec: InputSpec;
  values: number[];
  onChange: (values: number[]) => void;
  /** Searching: target value and whether the array must stay sorted. */
  target?: number;
  onTargetChange?: (target: number) => void;
  sorted?: boolean;
}

export function ArrayInput({ spec, values, onChange, target, onTargetChange, sorted }: ArrayInputProps) {
  const [preset, setPreset] = useState<Preset>('random');
  const [size, setSize] = useState(values.length);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const min = spec.valueMin ?? 1;
  const max = spec.valueMax ?? 99;

  const regenerate = (p = preset, n = size) => {
    const next = generate(p, n, min, max);
    onChange(sorted ? next.sort((a, b) => a - b) : next);
  };

  const applyText = () => {
    const parsed = parseValues(text, -999, 999, spec.max);
    if (typeof parsed === 'string') {
      setError(parsed);
      return;
    }
    if (parsed.length < spec.min) {
      setError(`At least ${spec.min} values`);
      return;
    }
    setError(null);
    setEditing(false);
    setSize(parsed.length);
    onChange(parsed);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2">
      {!editing ? (
        <>
          <select
            className="input pr-6"
            value={preset}
            onChange={(e) => {
              const p = e.target.value as Preset;
              setPreset(p);
              regenerate(p);
            }}
            aria-label="Input order"
            disabled={sorted}
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 font-mono text-[11px] text-faint">
            n
            <input
              type="range"
              min={spec.min}
              max={spec.max}
              value={size}
              onChange={(e) => {
                const n = Number(e.target.value);
                setSize(n);
                regenerate(preset, n);
              }}
              className="h-1 w-28 cursor-pointer accent-cyan"
            />
            <span className="w-6 text-muted tabular-nums">{size}</span>
          </label>
          <Button size="sm" icon={<Dices size={12} />} onClick={() => regenerate()}>
            Generate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Pencil size={11} />}
            onClick={() => {
              setText(values.join(', '));
              setEditing(true);
            }}
          >
            Custom
          </Button>
        </>
      ) : (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyText();
          }}
        >
          <input
            autoFocus
            className={cx('input min-w-48 flex-1', error && 'border-st-danger/60')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 5, 3, 9, 1"
            aria-label="Custom values"
          />
          <Button size="sm" variant="primary" type="submit">
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {error && <span className="font-mono text-[11px] text-st-swap">{error}</span>}
        </form>
      )}
      {onTargetChange && (
        <label className="ml-auto flex items-center gap-2 font-mono text-[11px] text-faint">
          target
          <input
            type="number"
            className="input w-20"
            value={target ?? 0}
            min={-999}
            max={999}
            onChange={(e) => onTargetChange(Math.max(-999, Math.min(999, Number(e.target.value) || 0)))}
          />
          <Button size="sm" variant="ghost" onClick={() => onTargetChange(values[Math.floor(Math.random() * values.length)] ?? 0)}>
            Present
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              let v = min;
              while (values.includes(v) && v < max) v++;
              onTargetChange(v);
            }}
          >
            Absent
          </Button>
        </label>
      )}
    </div>
  );
}
