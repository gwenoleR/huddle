/**
 * Cache des données ESPN prises à la demande (avant-match, direct, classement NFL).
 *
 * - Un seul appel à la fois par donnée : si 5 joueurs ouvrent le même match, ESPN n'est appelé qu'une fois.
 * - Une donnée un peu périmée est servie tout de suite et rafraîchie en arrière-plan (fenêtre « swr »).
 * - Si ESPN ne répond pas, on ressert la dernière version connue.
 * - Tout est rangé dans SQLite : un redémarrage ne fait pas tout re-télécharger, et les stats
 *   d'un match terminé depuis longtemps ne sont plus jamais redemandées.
 */
import { db, getMeta, setMeta } from './db';

/** Durée de vie infinie : la donnée ne change plus (match terminé depuis longtemps). */
export const FOREVER = Infinity;

interface Entry {
  at: number;
  expires: number;
  data: unknown;
}

const MEMORY_MAX = 300;
const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
let writes = 0;

/** Après une mise à jour de l'appli, le format des données a pu changer : on repart de zéro (appelé au démarrage). */
export function resetIfNewVersion(version = process.env.APP_VERSION ?? 'dev') {
  if (getMeta('espn_cache_version') === version) return;
  db.exec('DELETE FROM espn_cache');
  memory.clear();
  setMeta('espn_cache_version', version);
}

function read(key: string): Entry | null {
  const hit = memory.get(key);
  if (hit) return hit;
  const row = db.prepare('SELECT at, expires, data FROM espn_cache WHERE key = ?').get(key) as
    | { at: number; expires: number | null; data: string }
    | undefined;
  if (!row) return null;
  const entry = { at: row.at, expires: row.expires ?? FOREVER, data: JSON.parse(row.data) };
  keep(key, entry);
  return entry;
}

function keep(key: string, entry: Entry) {
  memory.delete(key);
  memory.set(key, entry);
  // La mémoire garde les plus récentes ; le reste reste disponible dans SQLite.
  if (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value!);
}

function write(key: string, data: unknown, ttl: number) {
  const at = Date.now();
  const expires = at + ttl;
  keep(key, { at, expires, data });
  db.prepare(
    `INSERT INTO espn_cache (key, at, expires, data) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET at = excluded.at, expires = excluded.expires, data = excluded.data`
  ).run(key, at, Number.isFinite(expires) ? expires : null, JSON.stringify(data));
  // De temps en temps, on jette ce qui est périmé depuis plus d'une semaine.
  if (++writes % 200 === 0) db.prepare('DELETE FROM espn_cache WHERE expires IS NOT NULL AND expires < ?').run(at - 7 * 24 * 3600_000);
}

export interface CacheOptions<T> {
  /** Durée pendant laquelle la donnée est considérée fraîche (ms), éventuellement selon son contenu. */
  ttl: number | ((data: T) => number);
  /** Au-delà, pendant cette durée, on sert l'ancienne version et on rafraîchit en arrière-plan. */
  swr?: number;
}

function refresh<T>(key: string, load: () => Promise<T>, opts: CacheOptions<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = load()
    .then((data) => {
      write(key, data, typeof opts.ttl === 'function' ? opts.ttl(data) : opts.ttl);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export async function cached<T>(key: string, load: () => Promise<T>, opts: CacheOptions<T>): Promise<T> {
  const now = Date.now();
  const hit = read(key);
  if (hit && now < hit.expires) return hit.data as T;
  if (hit && opts.swr && now < hit.expires + opts.swr) {
    refresh(key, load, opts).catch((e) => console.warn(`[espn] rafraîchissement de ${key} raté :`, (e as Error).message));
    return hit.data as T;
  }
  try {
    return await refresh(key, load, opts);
  } catch (e) {
    if (hit) return hit.data as T;
    throw e;
  }
}

/** Pour les tests : oublie la copie en mémoire, comme après un redémarrage (SQLite reste). */
export function forgetMemory() {
  memory.clear();
}

/** Pour les tests. */
export function clearEspnCache() {
  memory.clear();
  inflight.clear();
  db.exec('DELETE FROM espn_cache');
}
