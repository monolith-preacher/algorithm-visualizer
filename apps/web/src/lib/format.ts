import type { VarValue } from '@av/shared';

export function formatNs(ns: number): string {
  if (ns < 1000) {
    return `${ns.toFixed(ns < 10 ? 2 : 1)} ns`;
  }
  if (ns < 1e6) {
    return `${(ns / 1e3).toFixed(2)} µs`;
  }
  if (ns < 1e9) {
    return `${(ns / 1e6).toFixed(2)} ms`;
  }
  return `${(ns / 1e9).toFixed(2)} s`;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) {
    return '—';
  }
  return ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

/** Shortens a 64-bit address for compact labels, keeping the distinctive low digits. */
export function shortAddr(addr: string | null | undefined): string {
  if (!addr) {
    return 'NULL';
  }
  const hex = addr.replace(/^0x/, '');
  return hex.length > 6 ? `0x…${hex.slice(-5)}` : addr;
}

export function formatVar(value: VarValue | undefined, returnsBool = false): string {
  if (value === null) {
    return 'NULL';
  }
  if (value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (returnsBool && typeof value === 'number' && (value === 0 || value === 1)) {
    return value ? 'true' : 'false';
  }
  return String(value);
}
