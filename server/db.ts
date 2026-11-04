import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, seed } from './config';

mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'prono.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    start_points INTEGER NOT NULL DEFAULT 0,
    is_admin INTEGER NOT NULL DEFAULT 0,
    pin_hash TEXT,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    abbr TEXT NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    color TEXT,
    alt_color TEXT
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    kickoff INTEGER NOT NULL,
    status TEXT NOT NULL,
    detail TEXT,
    away_id TEXT NOT NULL REFERENCES teams(id),
    home_id TEXT NOT NULL REFERENCES teams(id),
    away_score INTEGER,
    home_score INTEGER,
    winner TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS games_week ON games(season, week);
  CREATE INDEX IF NOT EXISTS games_kickoff ON games(kickoff);

  CREATE TABLE IF NOT EXISTS picks (
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL REFERENCES games(id),
    side TEXT NOT NULL CHECK (side IN ('away', 'home')),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, game_id)
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sent_notifications (
    key TEXT PRIMARY KEY,
    sent_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

/** Premier démarrage : on crée les joueurs du fichier seed avec leurs points repris de l'ancien site. */
const { n } = db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number };
if (n === 0) {
  const insert = db.prepare('INSERT INTO players (name, start_points, is_admin, created_at) VALUES (?, ?, ?, ?)');
  for (const j of seed.joueurs) insert.run(j.prenom, j.pointsDeDepart, j.admin ? 1 : 0, Date.now());
  console.log(`[db] ${seed.joueurs.length} joueurs importés depuis le seed`);
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
