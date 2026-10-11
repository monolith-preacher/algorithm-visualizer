import type {
  ApiError,
  BenchRequest,
  BenchResponse,
  HealthResponse,
  SourceResponse,
  TraceRequest,
  TraceResponse,
} from '@av/shared';

export class RequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new RequestError('Cannot reach the server. Is it running? (npm run dev)', 'network');
  }
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new RequestError(`Unexpected response (${response.status}) from ${url}`, 'bad_response');
  }
  if (!response.ok) {
    const error = body as ApiError | null;
    throw new RequestError(error?.error ?? `Request failed (${response.status})`, error?.code);
  }
  return body as T;
}

const post = <T>(url: string, body: unknown) =>
  request<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const sourceCache = new Map<string, Promise<SourceResponse>>();

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  source: (id: string) => {
    let cached = sourceCache.get(id);
    if (!cached) {
      cached = request<SourceResponse>(`/api/lab/sources/${encodeURIComponent(id)}`);
      cached.catch(() => sourceCache.delete(id));
      sourceCache.set(id, cached);
    }
    return cached;
  },
  trace: (body: TraceRequest) => post<TraceResponse>('/api/lab/trace', body),
  bench: (body: BenchRequest) => post<BenchResponse>('/api/lab/bench', body),
};
