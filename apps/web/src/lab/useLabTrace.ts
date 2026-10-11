import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  analyzeSource,
  buildTrace,
  type AlgorithmInfo,
  type BenchResponse,
  type LabTrace,
  type SourceMap,
  type TraceEvent,
} from '@av/shared';

import { api } from '../lib/api';

/**
 * Runs an async request whenever `key` changes. Results are stored with the
 * key they belong to, so "loading" is derived (key differs from the stored
 * result's key) and stale responses of an earlier key are ignored.
 */
function useKeyedRequest<T>(key: string | null, load: () => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    if (key === null) {
      return;
    }
    let cancelled = false;
    loadRef
      .current()
      .then((data) => !cancelled && setState({ key, data, error: null }))
      .catch((e: Error) => !cancelled && setState({ key, data: null, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [key]);
  const current = key !== null && state.key === key;
  return {
    data: state.data,
    error: current ? state.error : null,
    loading: key !== null && !current,
    current,
  };
}

export interface SourceState {
  source: string;
  header: string;
  map: SourceMap;
}

export function useSource(algorithm: AlgorithmInfo | undefined): { source: SourceState | null; error: string | null } {
  const request = useKeyedRequest(algorithm?.id ?? null, async () => {
    const r = await api.source(algorithm?.id ?? '');
    return { source: r.source, header: r.header, map: analyzeSource(r.source) };
  });
  return { source: request.current ? request.data : null, error: request.error };
}

export interface TraceState {
  trace: LabTrace | null;
  events: TraceEvent[] | null;
  loading: boolean;
  error: string | null;
}

/** Runs the instrumented C implementation on the input and builds the step model. */
export function useLabTrace(
  algorithm: AlgorithmInfo | undefined,
  source: SourceState | null,
  input: string | null,
  traceFrom?: number,
): TraceState {
  const key = algorithm && source && input !== null ? JSON.stringify([algorithm.id, input, traceFrom ?? null]) : null;
  const request = useKeyedRequest(key, async () => {
    if (!algorithm || !source || input === null) {
      throw new Error('missing input');
    }
    const { events } = await api.trace({ algorithm: algorithm.id, input, ...(traceFrom !== undefined ? { traceFrom } : {}) });
    return { events, trace: buildTrace(algorithm, events, source.map) };
  });
  // The previous trace stays visible while a new one is computed.
  return {
    trace: request.data?.trace ?? null,
    events: request.data?.events ?? null,
    loading: request.loading,
    error: request.error,
  };
}

export interface BenchState {
  result: BenchResponse | null;
  loading: boolean;
  error: string | null;
}

/** CPU time of the uninstrumented build for sorting and searching algorithms. */
export function useBench(algorithm: AlgorithmInfo, input: string): BenchState {
  const enabled = algorithm.module === 'sorting' || algorithm.module === 'searching';
  const request = useKeyedRequest(enabled ? JSON.stringify([algorithm.id, input]) : null, () =>
    api.bench({ algorithm: algorithm.id, input }),
  );
  return { result: request.current ? request.data : null, loading: request.loading, error: request.error };
}
