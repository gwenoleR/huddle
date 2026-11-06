import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate, schemaVersion, type Migration } from '../../server/schema';

const fresh = () => new DatabaseSync(':memory:');
const tables = (db: DatabaseSync) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
const columns = (db: DatabaseSync, table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

describe('database migrations', () => {
  it('fresh database: all tables, at the latest version', () => {
    const db = fresh();
    expect(migrate(db).map((m) => m.version)).toEqual([1, 2, 3, 4]);
    expect(tables(db)).toEqual(
      ['bonus_picks', 'espn_cache', 'games', 'meta', 'picks', 'player_seasons', 'players', 'push_subscriptions', 'sent_notifications', 'sessions', 'teams'].sort()
    );
    expect(schemaVersion(db)).toBe(MIGRATIONS.at(-1)!.version);
  });

  it('on restart, nothing is replayed', () => {
    const db = fresh();
    migrate(db);
    expect(migrate(db)).toEqual([]);
  });

  it('database already in use (created before migrations): tables and data are kept', () => {
    // As in prod before this change: tables exist, but no version recorded.
    const db = fresh();
    db.exec(MIGRATIONS[0].sql);
    db.exec("INSERT INTO players (name, start_points, created_at) VALUES ('Gwen', 73, 0)");
    expect(schemaVersion(db)).toBe(0);
    migrate(db);
    expect(db.prepare('SELECT name FROM players').all()).toEqual([{ name: 'Gwen' }]);
    expect(schemaVersion(db)).toBe(MIGRATIONS.at(-1)!.version);
  });

  it('multiple seasons (4): starting points and start week move to the current season', () => {
    const db = fresh();
    migrate(db, MIGRATIONS.slice(0, 3));
    db.exec("INSERT INTO players (name, start_points, created_at) VALUES ('Gwen', 73, 0), ('Bea', 0, 0)");
    migrate(db);
    // Season 2026 in tests; start week 9 (tests/fixtures/seed.json).
    expect(db.prepare('SELECT p.name, s.season, s.start_points AS pts FROM player_seasons s JOIN players p ON p.id = s.player_id').all()).toEqual([
      { name: 'Gwen', season: 2026, pts: 73 }
    ]);
    expect(columns(db, 'players')).not.toContain('start_points');
    expect(db.prepare("SELECT value FROM meta WHERE key = 'start_week:2026'").get()).toEqual({ value: '9' });
  });

  it('a new migration added later runs alone', () => {
    const db = fresh();
    migrate(db);
    const next: Migration = { version: 5, name: 'nickname', sql: 'ALTER TABLE players ADD COLUMN nickname TEXT;' };
    expect(migrate(db, [...MIGRATIONS, next]).map((m) => m.version)).toEqual([5]);
    expect(columns(db, 'players')).toContain('nickname');
    expect(schemaVersion(db)).toBe(5);
  });

  it('a failing migration is rolled back entirely, and the message says which one', () => {
    const db = fresh();
    migrate(db);
    const broken: Migration = { version: 5, name: 'broken', sql: 'CREATE TABLE temp_x (a INT); ALTER TABLE nope ADD COLUMN b INT;' };
    expect(() => migrate(db, [...MIGRATIONS, broken])).toThrow('Migration 5 (broken) failed');
    expect(tables(db)).not.toContain('temp_x');
    expect(schemaVersion(db)).toBe(4);
  });

  it('version numbers are sequential, without duplicates', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.map((_, i) => i + 1));
  });
});
