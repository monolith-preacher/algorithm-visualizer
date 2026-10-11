import { useEffect, useState } from 'react';

import type { HealthResponse } from '@av/shared';

import { api } from './api';

export interface HealthState {
  health: HealthResponse | null;
  error: string | null;
  loading: boolean;
}

/** Polls /api/health so the UI can show which services are available. */
export function useHealth(intervalMs = 15000): HealthState {
  const [state, setState] = useState<HealthState>({ health: null, error: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .health()
        .then((health) => !cancelled && setState({ health, error: null, loading: false }))
        .catch((e: Error) => !cancelled && setState({ health: null, error: e.message, loading: false }));
    void load();
    const timer = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);
  return state;
}
