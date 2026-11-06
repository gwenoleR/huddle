import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate, schemaVersion, type Migration } from '../../server/schema';

const fresh = () => new DatabaseSync(':memory:');
const tables = (db: DatabaseSync) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
const columns = (db: DatabaseSync, table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

describe('migrations de la base', () => {
  it('base neuve : toutes les tables, à la dernière version', () => {
    const db = fresh();
    expect(migrate(db).map((m) => m.version)).toEqual([1, 2, 3, 4]);
    expect(tables(db)).toEqual(
      ['bonus_picks', 'espn_cache', 'games', 'meta', 'picks', 'player_seasons', 'players', 'push_subscriptions', 'sent_notifications', 'sessions', 'teams'].sort()
    );
    expect(schemaVersion(db)).toBe(MIGRATIONS.at(-1)!.version);
  });

  it('au redémarrage, rien n’est rejoué', () => {
    const db = fresh();
    migrate(db);
    expect(migrate(db)).toEqual([]);
  });

  it('base déjà en service (créée avant les migrations) : les tables et les données restent', () => {
    // Comme en prod avant ce changement : tables là, mais aucune version enregistrée.
    const db = fresh();
    db.exec(MIGRATIONS[0].sql);
    db.exec("INSERT INTO players (name, start_points, created_at) VALUES ('Gwen', 73, 0)");
    expect(schemaVersion(db)).toBe(0);
    migrate(db);
    expect(db.prepare('SELECT name FROM players').all()).toEqual([{ name: 'Gwen' }]);
    expect(schemaVersion(db)).toBe(MIGRATIONS.at(-1)!.version);
  });

  it('plusieurs saisons (4) : les points de départ et la semaine de reprise passent à la saison en cours', () => {
    const db = fresh();
    migrate(db, MIGRATIONS.slice(0, 3));
    db.exec("INSERT INTO players (name, start_points, created_at) VALUES ('Gwen', 73, 0), ('Bea', 0, 0)");
    migrate(db);
    // Saison 2026 dans les tests ; semaine de reprise 9 (tests/fixtures/seed.json).
    expect(db.prepare('SELECT p.name, s.season, s.start_points AS pts FROM player_seasons s JOIN players p ON p.id = s.player_id').all()).toEqual([
      { name: 'Gwen', season: 2026, pts: 73 }
    ]);
    expect(columns(db, 'players')).not.toContain('start_points');
    expect(db.prepare("SELECT value FROM meta WHERE key = 'start_week:2026'").get()).toEqual({ value: '9' });
  });

  it('une nouvelle migration ajoutée plus tard ne joue qu’elle', () => {
    const db = fresh();
    migrate(db);
    const next: Migration = { version: 5, name: 'surnom', sql: 'ALTER TABLE players ADD COLUMN nickname TEXT;' };
    expect(migrate(db, [...MIGRATIONS, next]).map((m) => m.version)).toEqual([5]);
    expect(columns(db, 'players')).toContain('nickname');
    expect(schemaVersion(db)).toBe(5);
  });

  it('une migration qui échoue est annulée en entier, et le message dit laquelle', () => {
    const db = fresh();
    migrate(db);
    const broken: Migration = { version: 5, name: 'cassée', sql: 'CREATE TABLE temp_x (a INT); ALTER TABLE nope ADD COLUMN b INT;' };
    expect(() => migrate(db, [...MIGRATIONS, broken])).toThrow('Migration 5 (cassée) impossible');
    expect(tables(db)).not.toContain('temp_x');
    expect(schemaVersion(db)).toBe(4);
  });

  it('les numéros se suivent, sans doublon', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.map((_, i) => i + 1));
  });
});
