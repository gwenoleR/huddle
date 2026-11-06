/**
 * Shared helpers for server tests: database reset, hand-made teams and games.
 * The database is in memory (see vitest.config.ts), one per test file.
 */
import { db, setMeta } from '../../server/db';
import { clearEspnCache } from '../../server/espnCache';
import { resetEspnStats } from '../../server/espn';

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;
/** A Sunday in the season, 7 pm in Paris: the reference time for all tests. */
export const NOW = Date.parse('2026-11-08T18:00:00Z');

/** A few teams, with their real ESPN ids. */
export const TEAMS = {
  BUF: { id: '2', name: 'Bills', conf: 'AFC' },
  KC: { id: '12', name: 'Chiefs', conf: 'AFC' },
  BAL: { id: '33', name: 'Ravens', conf: 'AFC' },
  PIT: { id: '23', name: 'Steelers', conf: 'AFC' },
  SF: { id: '25', name: '49ers', conf: 'NFC' },
  PHI: { id: '21', name: 'Eagles', conf: 'NFC' },
  DET: { id: '8', name: 'Lions', conf: 'NFC' },
  DAL: { id: '6', name: 'Cowboys', conf: 'NFC' }
} as const;
export type Abbr = keyof typeof TEAMS;

export function resetDb() {
  clearEspnCache();
  resetEspnStats();
  db.exec(`
    DELETE FROM picks; DELETE FROM bonus_picks; DELETE FROM games; DELETE FROM teams;
    DELETE FROM sessions; DELETE FROM push_subscriptions; DELETE FROM sent_notifications;
    DELETE FROM meta WHERE key NOT LIKE 'vapid_%' AND key NOT LIKE 'start_week:%';
    UPDATE players SET pin_hash = NULL, failed_attempts = 0, locked_until = 0;
  `);
  const insert = db.prepare('INSERT INTO teams (id, abbr, name, display_name, color, alt_color) VALUES (?, ?, ?, ?, ?, ?)');
  for (const [abbr, t] of Object.entries(TEAMS)) insert.run(t.id, abbr, t.name, `${abbr} ${t.name}`, '003366', 'ffffff');
}

export const pid = (name: string) => (db.prepare('SELECT id FROM players WHERE name = ?').get(name) as { id: number }).id;

let seq = 0;
export interface GameOpts {
  id?: string;
  /** 2026 by default (the test season). */
  season?: number;
  week?: number;
  kickoff?: number;
  away?: Abbr;
  home?: Abbr;
  /** Score [away, home]: status becomes 'final' unless status is given. */
  score?: [number, number];
  status?: 'scheduled' | 'live' | 'final' | 'postponed';
  detail?: string | null;
}

/** Adds a game; with a score and no status, it is final and the winner is derived. */
export function addGame(o: GameOpts = {}): string {
  const id = o.id ?? `g${++seq}`;
  const status = o.status ?? (o.score ? 'final' : 'scheduled');
  const [a, h] = o.score ?? [null, null];
  const winner = status === 'final' && a != null && h != null ? (a > h ? 'away' : h > a ? 'home' : 'tie') : null;
  db.prepare(
    `INSERT INTO games (id, season, week, kickoff, status, detail, away_id, home_id, away_score, home_score, winner, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(id, o.season ?? 2026, o.week ?? 10, o.kickoff ?? NOW - DAY, status, o.detail ?? null, TEAMS[o.away ?? 'BUF'].id, TEAMS[o.home ?? 'KC'].id, a, h, winner);
  return id;
}

export function setGame(id: string, fields: { status?: string; away_score?: number; home_score?: number; detail?: string | null; winner?: string | null }) {
  for (const [k, v] of Object.entries(fields)) db.prepare(`UPDATE games SET ${k} = ? WHERE id = ?`).run(v as never, id);
}

export function pick(name: string, gameId: string, side: 'away' | 'home', at = NOW - 2 * DAY) {
  db.prepare(
    `INSERT INTO picks (player_id, game_id, side, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(player_id, game_id) DO UPDATE SET side = excluded.side, updated_at = excluded.updated_at`
  ).run(pid(name), gameId, side, at);
}

/** Picks for several players at once. */
export function picks(gameId: string, sides: Record<string, 'away' | 'home'>) {
  for (const [name, side] of Object.entries(sides)) pick(name, gameId, side);
}

export function subscribe(name: string, endpoint = `https://push.example/${name}`) {
  db.prepare('INSERT INTO push_subscriptions (endpoint, player_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, 0)').run(endpoint, pid(name), 'k', 'a');
}

export { db, setMeta };

export const getMetaValue = (key: string) => (db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined)?.value;
