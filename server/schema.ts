/**
 * Every database table, in one place, as numbered migrations.
 *
 * SQLite remembers the last applied migration (PRAGMA user_version): on startup, only the new ones
 * run, each in a transaction. To change the database (new table, new column…), APPEND a migration
 * at the end; never modify a migration that has already been deployed.
 *
 * The first three use "IF NOT EXISTS": they describe tables that already existed before this file,
 * and must pass without breaking anything on a database already in service.
 */
import type { DatabaseSync } from 'node:sqlite';
import { INITIAL_START_WEEK, currentSeason } from './config';

export interface Migration {
  version: number;
  name: string;
  sql: string;
  /** Data backfill, in the same transaction, once the SQL has run. */
  after?: (db: DatabaseSync) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'players, games, picks, notifications',
    sql: `
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
`
  },
  {
    version: 2,
    name: 'end-of-season bonus',
    sql: `
  CREATE TABLE IF NOT EXISTS bonus_picks (
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season INTEGER NOT NULL,
    afc TEXT NOT NULL,
    nfc TEXT NOT NULL,
    sb TEXT NOT NULL,
    sb_total INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, season)
  );
`
  },
  {
    version: 3,
    name: 'ESPN cache',
    sql: `
  CREATE TABLE IF NOT EXISTS espn_cache (
    key TEXT PRIMARY KEY,
    at INTEGER NOT NULL,
    expires INTEGER,
    data TEXT NOT NULL
  );
`
  },
  {
    version: 4,
    name: 'multiple seasons: starting points and first week per season',
    // Starting points belong to a season (carried over from another site, or joining mid-season):
    // they move out of the players table. Each season's first counted week lives in meta
    // (start_week:<season>, 1 by default).
    sql: `
  CREATE TABLE player_seasons (
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season INTEGER NOT NULL,
    start_points INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, season)
  );
`,
    after(db) {
      const season = currentSeason();
      db.prepare('INSERT INTO player_seasons (player_id, season, start_points) SELECT id, ?, start_points FROM players WHERE start_points > 0').run(season);
      db.exec('ALTER TABLE players DROP COLUMN start_points');
      if (INITIAL_START_WEEK > 1)
        db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(`start_week:${season}`, String(INITIAL_START_WEEK));
    }
  }
];

export const schemaVersion = (db: DatabaseSync) => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

/** Applies the migrations not yet run, in order. Returns those that ran. */
export function migrate(db: DatabaseSync, migrations: Migration[] = MIGRATIONS): Migration[] {
  const done: Migration[] = [];
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version <= schemaVersion(db)) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      m.after?.(db);
      db.exec(`PRAGMA user_version = ${Number(m.version)}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${m.version} (${m.name}) failed: ${(e as Error).message}`);
    }
    done.push(m);
  }
  return done;
}
