/**
 * Records a sample database at the current schema, for the upgrade test (tests/server/upgrade.test.ts):
 * every release keeps the database it would leave behind, and each later version must open it, run
 * its migrations and give the same standings. Run it when releasing, before tagging:
 *
 *   npm run db:snapshot -- 1.2.0
 *
 * It writes tests/fixtures/db/<version>.sqlite and <version>.json (what the test expects).
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const version = process.argv[2] ?? '';
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: npm run db:snapshot -- <x.y.z>');
  process.exit(1);
}

const dir = path.resolve('tests/fixtures/db');
const file = path.join(dir, `${version}.sqlite`);
mkdirSync(dir, { recursive: true });
for (const f of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(f)) rmSync(f);

// Read by server/config.ts and server/db.ts when they load: set before importing them.
process.env.DB_FILE = file;
process.env.DATA_DIR = dir;
process.env.SEED_FILE = path.resolve('tests/fixtures/seed.json');
process.env.SEASON = '2026';
process.env.SYNC = 'off';

const { db, setMeta, setStartPoints } = await import('../server/db');
const { schemaVersion } = await import('../server/schema');
const { standings } = await import('../server/scoring');

const DAY = 24 * 3600_000;
const TEAMS: [string, string, string][] = [
  ['2', 'BUF', 'Bills'],
  ['12', 'KC', 'Chiefs'],
  ['33', 'BAL', 'Ravens'],
  ['23', 'PIT', 'Steelers'],
  ['25', 'SF', '49ers'],
  ['21', 'PHI', 'Eagles'],
  ['8', 'DET', 'Lions'],
  ['6', 'DAL', 'Cowboys']
];
const insertTeam = db.prepare('INSERT INTO teams (id, abbr, name, display_name, color, alt_color) VALUES (?, ?, ?, ?, ?, ?)');
for (const [id, abbr, name] of TEAMS) insertTeam.run(id, abbr, name, `${abbr} ${name}`, '003366', 'ffffff');

const players = db.prepare('SELECT id, name FROM players ORDER BY id').all() as { id: number; name: string }[];
const insertGame = db.prepare(
  `INSERT INTO games (id, season, week, kickoff, status, detail, away_id, home_id, away_score, home_score, winner, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
);
const insertPick = db.prepare('INSERT INTO picks (player_id, game_id, side, updated_at) VALUES (?, ?, ?, ?)');

/** A game and everyone's pick: player i picks home when (i + n) is even, so results vary per player. */
let n = 0;
function game(season: number, week: number, kickoff: number, score: [number, number] | null, status = score ? 'final' : 'scheduled') {
  const id = `snap-${season}-${++n}`;
  const [away, home] = [TEAMS[n % 8][0], TEAMS[(n + 3) % 8][0]];
  const [a, h] = score ?? [null, null];
  const winner = status === 'final' && a != null && h != null ? (a > h ? 'away' : h > a ? 'home' : 'tie') : null;
  insertGame.run(id, season, week, kickoff, status, status === 'final' ? 'Terminé' : null, away, home, a, h, winner);
  players.forEach((p, i) => insertPick.run(p.id, id, (i + n) % 2 ? 'away' : 'home', kickoff - DAY));
}

const T2026 = Date.parse('2026-09-10T00:00:00Z');
// A past season, with a Super Bowl.
for (let w = 1; w <= 3; w++) game(2025, w, Date.parse('2025-09-10T00:00:00Z') + (w - 1) * 7 * DAY, [17 + w, 20 - w]);
game(2025, 22, Date.parse('2026-02-08T23:30:00Z'), [24, 27]);
// The current season (start week 9 in the seed): weeks before it don't count, then finals, a tie,
// a live game and games still to play.
for (let w = 8; w <= 11; w++) {
  game(2026, w, T2026 + (w - 1) * 7 * DAY, [21 + w, 14 + 2 * w]);
  game(2026, w, T2026 + (w - 1) * 7 * DAY + 3 * 3600_000, [20, 20]);
}
game(2026, 12, T2026 + 11 * 7 * DAY, [7, 3], 'live');
game(2026, 13, T2026 + 12 * 7 * DAY, null);

// Per-season start points (one player joined mid-season in 2025 too), bonus picks, sessions,
// push subscriptions and settings: everything a real instance holds.
setStartPoints(players[0].id, 5, 2025);
for (const p of players)
  db.prepare('INSERT INTO bonus_picks (player_id, season, afc, nfc, sb, sb_total, updated_at) VALUES (?, 2026, ?, ?, ?, ?, 0)').run(p.id, '2', '25', '2', 45);
db.prepare('INSERT INTO sessions (token, player_id, expires_at) VALUES (?, ?, ?)').run('snapshot-session', players[0].id, Date.parse('2030-01-01'));
db.prepare('INSERT INTO push_subscriptions (endpoint, player_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, 0)').run('https://push.example/snap', players[1].id, 'k', 'a');
setMeta('bonus_settings', JSON.stringify({ enabled: true, points: { afc: 3, nfc: 3, sb: 5 }, reveal: 'wildcard' }));

const ranked = (season: number) => standings(undefined, season).map((r) => ({ name: r.name, points: r.points, rank: r.rank }));
const expected = {
  version,
  schemaVersion: schemaVersion(db),
  players: players.length,
  picks: (db.prepare('SELECT COUNT(*) AS n FROM picks').get() as { n: number }).n,
  standings: { 2025: ranked(2025), 2026: ranked(2026) }
};
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
db.close();
for (const f of [`${file}-wal`, `${file}-shm`]) if (existsSync(f)) rmSync(f);
writeFileSync(path.join(dir, `${version}.json`), `${JSON.stringify(expected, null, 2)}\n`);
console.log(`[snapshot] ${path.relative(process.cwd(), file)}: schema ${expected.schemaVersion}, ${expected.picks} picks`);
