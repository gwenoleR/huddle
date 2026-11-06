/**
 * Upgrading an instance: every released version left a sample database in tests/fixtures/db
 * (recorded with `npm run db:snapshot -- <version>` at release time). The current code must open
 * each of them, run its migrations, and give exactly the standings that version gave.
 */
import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('web-push', () => ({
  default: { generateVAPIDKeys: () => ({ publicKey: 'pub', privateKey: 'priv' }), setVapidDetails: () => {}, sendNotification: vi.fn() }
}));

const DIR = 'tests/fixtures/db';
const releases = readdirSync(DIR)
  .filter((f) => f.endsWith('.sqlite'))
  .map((f) => f.replace(/\.sqlite$/, ''));

interface Expected {
  schemaVersion: number;
  players: number;
  picks: number;
  standings: Record<string, { name: string; points: number; rank: number }[]>;
}

/** Opens a copy of a release's database with the current code (the original stays untouched). */
async function openRelease(version: string) {
  const work = mkdtempSync(path.join(tmpdir(), `prono-upgrade-${version}-`));
  const file = path.join(work, 'prono.db');
  copyFileSync(path.join(DIR, `${version}.sqlite`), file);
  vi.resetModules();
  process.env.DB_FILE = file;
  const { db } = await import('../../server/db');
  const { MIGRATIONS, schemaVersion } = await import('../../server/schema');
  const { standings } = await import('../../server/scoring');
  const Fastify = (await import('fastify')).default;
  const cookie = (await import('@fastify/cookie')).default;
  const { routes } = await import('../../server/routes');
  const app = Fastify();
  await app.register(cookie);
  await app.register(routes);
  return { db, MIGRATIONS, schemaVersion, standings, app };
}

describe('upgrading from a released version', () => {
  it('there is at least one recorded release', () => {
    expect(releases.length).toBeGreaterThan(0);
  });

  it.each(releases)('%s: migrations run, nothing is lost, standings unchanged', async (version) => {
    const expected = JSON.parse(readFileSync(path.join(DIR, `${version}.json`), 'utf8')) as Expected;
    const { db, MIGRATIONS, schemaVersion, standings, app } = await openRelease(version);

    expect(expected.schemaVersion).toBeLessThanOrEqual(MIGRATIONS.at(-1)!.version);
    expect(schemaVersion(db)).toBe(MIGRATIONS.at(-1)!.version);
    expect((db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number }).n).toBe(expected.players);
    expect((db.prepare('SELECT COUNT(*) AS n FROM picks').get() as { n: number }).n).toBe(expected.picks);
    for (const [season, rows] of Object.entries(expected.standings))
      expect(standings(undefined, Number(season)).map((r) => ({ name: r.name, points: r.points, rank: r.rank }))).toEqual(rows);

    // Sessions survive the upgrade: nobody has to log in again.
    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: { cookie: 'prono_session=snapshot-session' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().rows).toHaveLength(expected.players);
    await app.close();
    db.close();
  });
});
