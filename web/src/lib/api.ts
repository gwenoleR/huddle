import { t } from './i18n';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
  }
}

/** Event sent when the server no longer recognizes the session (code reset, session expired). */
export const SESSION_LOST = 'session-lost';

/**
 * A 401 means "no longer logged in", except for a wrong code at login (/login)
 * and for the startup check (/me), which already leads to the login screen.
 */
export function endsSession(path: string, status: number): boolean {
  return status === 401 && path !== '/login' && path !== '/me';
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? 'GET',
      headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin'
    });
  } catch {
    throw new ApiError(0, t.common.errors.network);
  }
  const data = await res.json().catch(() => null);
  if (endsSession(path, res.status)) dispatchEvent(new Event(SESSION_LOST));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? t.common.errors.server, data);
  return data as T;
}

// The types returned by the server are shared with it: shared/api.ts.
export type * from '../../../shared/api';
