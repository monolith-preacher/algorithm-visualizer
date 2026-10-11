export type Preset = 'random' | 'ascending' | 'descending' | 'nearly' | 'few-unique';

export const PRESETS: { value: Preset; label: string }[] = [
  { value: 'random', label: 'Random' },
  { value: 'ascending', label: 'Ascending' },
  { value: 'descending', label: 'Descending' },
  { value: 'nearly', label: 'Nearly sorted' },
  { value: 'few-unique', label: 'Few unique' },
];

const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

/** Generates an input array within [min, max]. */
export function generate(preset: Preset, n: number, min: number, max: number): number[] {
  const random = () => Array.from({ length: n }, () => randInt(min, max));
  const spread = () => {
    // Evenly spaced values over the range, so ordered presets use the full height.
    const step = n > 1 ? (max - min) / (n - 1) : 0;
    return Array.from({ length: n }, (_, i) => Math.round(min + i * step));
  };
  switch (preset) {
    case 'ascending':
      return spread();
    case 'descending':
      return spread().reverse();
    case 'nearly': {
      const a = spread();
      const swaps = Math.max(1, Math.round(n / 10));
      for (let k = 0; k < swaps; k++) {
        const i = randInt(0, n - 2);
        [a[i], a[i + 1]] = [a[i + 1] as number, a[i] as number];
      }
      return a;
    }
    case 'few-unique': {
      const pool = Array.from({ length: 4 }, () => randInt(min, max));
      return Array.from({ length: n }, () => pool[randInt(0, pool.length - 1)] as number);
    }
    default:
      return random();
  }
}

/** Parses "5, 3 9;1" into integers; returns an error message for invalid input. */
export function parseValues(text: string, min: number, max: number, maxCount: number): number[] | string {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length === 0) {
    return 'Enter at least one integer';
  }
  if (tokens.length > maxCount) {
    return `At most ${maxCount} values`;
  }
  const values: number[] = [];
  for (const token of tokens) {
    if (!/^-?\d+$/.test(token)) {
      return `"${token}" is not an integer`;
    }
    const v = Number(token);
    if (v < min || v > max) {
      return `Values must be in [${min}, ${max}]`;
    }
    values.push(v);
  }
  return values;
}
