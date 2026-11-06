import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { DATA_DIR, DB_FILE, currentSeason, seed } from './config';
import { migrate } from './schema';

mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_FILE);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

for (const m of migrate(db)) console.log(`[db] migration ${m.version}: ${m.name}`);

/** First start with a seed file: create its players. Without a seed, the group is created from the app. */
const { n } = db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number };
if (n === 0 && seed) {
  const insert = db.prepare('INSERT INTO players (name, is_admin, created_at) VALUES (?, ?, ?)');
  for (const p of seed.players) {
    const { lastInsertRowid } = insert.run(p.name, p.admin ? 1 : 0, Date.now());
    if (p.startPoints) setStartPoints(Number(lastInsertRowid), p.startPoints);
  }
  console.log(`[db] ${seed.players.length} players imported from the seed`);
}

export function getMeta(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setMeta(key: string, value: string) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------- Seasons ----------

/** First week whose picks count for a season (1, unless taken over mid-season). */
export function startWeek(season = currentSeason()): number {
  return Number(getMeta(`start_week:${season}`) ?? 1);
}

/** A player's starting points for a season (carried over from another site, or joining mid-season). */
export function setStartPoints(playerId: number, points: number, season = currentSeason()) {
  db.prepare(
    `INSERT INTO player_seasons (player_id, season, start_points) VALUES (?, ?, ?)
     ON CONFLICT(player_id, season) DO UPDATE SET start_points = excluded.start_points`
  ).run(playerId, season, points);
}

/** Seasons that can be browsed: those with games in the database, plus always the current season. */
export function knownSeasons(): number[] {
  const rows = db.prepare('SELECT DISTINCT season FROM games').all() as { season: number }[];
  return [...new Set([...rows.map((r) => r.season), currentSeason()])].sort((a, b) => b - a);
}
