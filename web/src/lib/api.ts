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

/** Événement envoyé quand le serveur ne reconnaît plus la session (code remis à zéro, session expirée). */
export const SESSION_LOST = 'session-lost';

/**
 * Un 401 veut dire « plus connecté », sauf pour un mauvais code à la connexion (/login)
 * et pour la vérification au démarrage (/me), qui mène déjà à l'écran de connexion.
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

// Les types renvoyés par le serveur sont partagés avec lui : shared/api.ts.
export type * from '../../../shared/api';
