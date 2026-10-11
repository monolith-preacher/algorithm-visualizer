import type { DebugFrame, DebugSnapshot, DebugValue, MemoryRegion } from '@av/shared';

/** All values of the selected frame plus globals, keyed by expression, for change detection. */
export function flatten(values: DebugValue[], into = new Map<string, string>()): Map<string, string> {
  for (const v of values) {
    into.set(v.expression, v.value);
    if (v.children) {
      flatten(v.children, into);
    }
  }
  return into;
}

export function frameValues(snapshot: DebugSnapshot | null, level: number): DebugValue[] {
  const frame = snapshot?.frames.find((f) => f.level === level);
  return frame ? [...frame.args, ...frame.locals] : [];
}

/** Previous values for the same function, so changes can be highlighted after a step. */
export function previousValues(previous: DebugSnapshot | null, frame: DebugFrame | undefined): Map<string, string> {
  if (!previous || !frame) {
    return new Map();
  }
  const match = previous.frames.find((f) => f.func === frame.func && f.user);
  return flatten([...(match ? [...match.args, ...match.locals] : []), ...previous.globals]);
}

export function regionOf(address: string | null | undefined, snapshot: DebugSnapshot): MemoryRegion['name'] | null {
  if (!address) {
    return null;
  }
  const a = BigInt(address);
  for (const r of snapshot.regions) {
    if (a >= BigInt(r.start) && a < BigInt(r.end)) {
      return r.name;
    }
  }
  for (const b of snapshot.heap) {
    if (a >= BigInt(b.address) && a < BigInt(b.address) + BigInt(b.size)) {
      return 'heap';
    }
  }
  return null;
}

/** Displays GDB's value text compactly (pointers keep their full address). */
export function displayValue(v: DebugValue): string {
  if (v.kind === 'array' && v.children && !/char/.test(v.type)) {
    return `[${v.children.length}${v.truncated ? '+' : ''}]`;
  }
  if (v.kind === 'struct') {
    return '{…}';
  }
  if (v.kind === 'pointer' && v.pointsTo === null && /^0x0+$/.test(v.value)) {
    return 'NULL';
  }
  return v.value;
}
