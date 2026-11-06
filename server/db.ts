import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { DATA_DIR, DB_FILE, seed } from './config';
import { migrate } from './schema';

mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_FILE);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

for (const m of migrate(db)) console.log(`[db] migration ${m.version} : ${m.name}`);

/** Premier démarrage avec un fichier seed : on crée ses joueurs. Sans seed, le groupe se crée depuis l'appli. */
const { n } = db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number };
if (n === 0 && seed) {
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
