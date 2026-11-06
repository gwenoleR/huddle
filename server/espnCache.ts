/**
 * Cache for ESPN data fetched on demand (preview, live, NFL standings).
 *
 * - Only one call at a time per item: if 5 players open the same game, ESPN is called only once.
 * - Slightly stale data is served right away and refreshed in the background (the "swr" window).
 * - If ESPN doesn't respond, the last known version is served again.
 * - Everything is stored in SQLite: a restart doesn't re-download everything, and the stats
 *   of a game finished long ago are never requested again.
 */
import { APP_LANG, APP_VERSION } from './config';
import { db, getMeta, setMeta } from './db';

/** Infinite lifetime: the data no longer changes (game finished long ago). */
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

/**
 * Called on startup. The cache holds data already turned into display text, so it starts from scratch
 * after an app update (the format may have changed) or a language change (APP_LANG): otherwise
 * finished games, kept forever, would stay in the old language.
 */
export function resetIfNewVersion(version = `${APP_VERSION}:${APP_LANG}`) {
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
  // Memory keeps the most recent entries; the rest remains available in SQLite.
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
  // Every now and then, drop entries that expired more than a week ago.
  if (++writes % 200 === 0) db.prepare('DELETE FROM espn_cache WHERE expires IS NOT NULL AND expires < ?').run(at - 7 * 24 * 3600_000);
}

export interface CacheOptions<T> {
  /** How long the data is considered fresh (ms), possibly depending on its content. */
  ttl: number | ((data: T) => number);
  /** Beyond that, for this long, serve the old version and refresh in the background. */
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
    refresh(key, load, opts).catch((e) => console.warn(`[espn] refresh of ${key} failed:`, (e as Error).message));
    return hit.data as T;
  }
  try {
    return await refresh(key, load, opts);
  } catch (e) {
    if (hit) return hit.data as T;
    throw e;
  }
}

/** For tests: forget the in-memory copy, as after a restart (SQLite remains). */
export function forgetMemory() {
  memory.clear();
}

/** For tests. */
export function clearEspnCache() {
  memory.clear();
  inflight.clear();
  db.exec('DELETE FROM espn_cache');
}
