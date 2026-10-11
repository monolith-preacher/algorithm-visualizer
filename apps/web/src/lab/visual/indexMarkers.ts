import type { Vars } from '@av/shared';

/** Local variables that hold indices into each array, per algorithm. */
const INDEX_VARS: Record<string, { a: string[]; aux?: string[] }> = {
  'bubble-sort': { a: ['j'] },
  'selection-sort': { a: ['i', 'j', 'min'] },
  'insertion-sort': { a: ['i', 'j'] },
  'merge-sort': { a: ['k', 'lo', 'mid', 'hi'], aux: ['i', 'j'] },
  'quick-sort': { a: ['i', 'j', 'lo', 'hi'] },
  'heap-sort': { a: ['i', 'largest', 'left', 'right'] },
  'linear-search': { a: ['i'] },
  'binary-search': { a: ['lo', 'mid', 'hi'] },
};

export interface IndexMarker {
  name: string;
  index: number;
}

/** Markers for index variables of the innermost frame that point inside [0, n). */
export function indexMarkers(algorithm: string, vars: Vars | undefined, n: number, array: 'a' | 'aux' = 'a'): IndexMarker[] {
  const names = INDEX_VARS[algorithm]?.[array] ?? [];
  const markers: IndexMarker[] = [];
  for (const name of names) {
    const value = vars?.[name];
    if (typeof value === 'number' && value >= 0 && value < n) {
      markers.push({ name, index: value });
    }
  }
  return markers;
}
