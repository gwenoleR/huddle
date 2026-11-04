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
    expect(migrate(db).map((m) => m.version)).toEqual([1, 2, 3]);
    expect(tables(db)).toEqual(
      ['bonus_picks', 'espn_cache', 'games', 'meta', 'picks', 'players', 'push_subscriptions', 'sent_notifications', 'sessions', 'teams'].sort()
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
    expect(db.prepare('SELECT name, start_points FROM players').all()).toEqual([{ name: 'Gwen', start_points: 73 }]);
    expect(schemaVersion(db)).toBe(3);
  });

  it('une nouvelle migration ajoutée plus tard ne joue qu’elle', () => {
    const db = fresh();
    migrate(db);
    const next: Migration = { version: 4, name: 'surnom', sql: 'ALTER TABLE players ADD COLUMN nickname TEXT;' };
    expect(migrate(db, [...MIGRATIONS, next]).map((m) => m.version)).toEqual([4]);
    expect(columns(db, 'players')).toContain('nickname');
    expect(schemaVersion(db)).toBe(4);
  });

  it('une migration qui échoue est annulée en entier, et le message dit laquelle', () => {
    const db = fresh();
    migrate(db);
    const broken: Migration = { version: 4, name: 'cassée', sql: 'CREATE TABLE temp_x (a INT); ALTER TABLE nope ADD COLUMN b INT;' };
    expect(() => migrate(db, [...MIGRATIONS, broken])).toThrow('Migration 4 (cassée) impossible');
    expect(tables(db)).not.toContain('temp_x');
    expect(schemaVersion(db)).toBe(3);
  });

  it('les numéros se suivent, sans doublon', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.map((_, i) => i + 1));
  });
});
