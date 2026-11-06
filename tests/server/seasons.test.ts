/**
 * Multiple seasons in the same database: the current season switches by itself on June 1, and
 * past seasons stay viewable (standings, summary) with their own starting points.
 * In tests, the current season is 2026, starting at week 9 (tests/fixtures/seed.json).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('web-push', () => ({
  default: { generateVAPIDKeys: () => ({ publicKey: 'pub', privateKey: 'priv' }), setVapidDetails: () => {}, sendNotification: vi.fn() }
}));

const Fastify = (await import('fastify')).default;
const cookie = (await import('@fastify/cookie')).default;
const { routes } = await import('../../server/routes');
const { currentSeason } = await import('../../server/config');
const { knownSeasons, setStartPoints, startWeek } = await import('../../server/db');
const { awards, standings } = await import('../../server/scoring');
const { DAY, NOW, addGame, db, pick, pid, resetDb } = await import('./helpers');

const app = Fastify();
await app.register(cookie);
await app.register(routes);

beforeEach(() => {
  resetDb();
  db.exec('DELETE FROM player_seasons WHERE season = 2025');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

let ipSeq = 0;
async function login(name: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { playerId: pid(name), pin: '1234' },
    headers: { 'cf-connecting-ip': `10.9.0.${++ipSeq}` }
  });
  const c = res.cookies.find((x) => x.name === 'prono_session')!;
  return `${c.name}=${c.value}`;
}
const get = async (url: string) => app.inject({ method: 'GET', url, headers: { cookie: await login('Gwen') } });

/** Season 2025: Bea and Audrey played, the others hadn't joined yet. */
function season2025() {
  const g1 = addGame({ season: 2025, week: 3, kickoff: NOW - 400 * DAY, score: [10, 20] }); // KC wins
  const g2 = addGame({ season: 2025, week: 22, kickoff: NOW - 300 * DAY, score: [30, 20], away: 'SF', home: 'BUF' }); // Super Bowl, SF wins
  pick('Bea', g1, 'home');
  pick('Bea', g2, 'away');
  pick('Audrey', g1, 'away');
  setStartPoints(pid('Audrey'), 1, 2025);
}

describe('current season', () => {
  it('follows the date unless pinned: new season on June 1', () => {
    const pinned = process.env.SEASON;
    delete process.env.SEASON;
    try {
      expect(currentSeason(Date.parse('2027-02-08T00:00:00Z'))).toBe(2026);
      expect(currentSeason(Date.parse('2027-06-01T00:00:00Z'))).toBe(2027);
    } finally {
      process.env.SEASON = pinned;
    }
  });

  it('each season has its own first counted week (start at week 9 only applies to 2026)', () => {
    expect(startWeek(2026)).toBe(9);
    expect(startWeek(2025)).toBe(1);
  });

  it('viewable seasons: those with games, plus the current season, most recent first', () => {
    expect(knownSeasons()).toEqual([2026]);
    season2025();
    expect(knownSeasons()).toEqual([2026, 2025]);
  });
});

describe('past season', () => {
  it('standings: its picks, its starting points, and only those who played in it', () => {
    season2025();
    const rows = standings(undefined, 2025);
    expect(rows.map((r) => [r.name, r.points, r.startPoints])).toEqual([
      ['Bea', 3, 0], // 1 + 2 (Super Bowl)
      ['Audrey', 1, 1]
    ]);
  });

  it('does not leak into the current season', () => {
    season2025();
    const now = Object.fromEntries(standings().map((r) => [r.name, r.points]));
    expect(now).toEqual({ Gwen: 73, Audrey: 72, Bea: 71, Bud: 69, Max: 64 }); // 2026 starting points, nothing from 2025
  });

  it('awards computed for the requested season', () => {
    season2025();
    const best = awards(2025).find((a) => a.id === 'best-week')!;
    expect(best.who).toBe('Bea');
    expect(awards().find((a) => a.id === 'best-week')!.who).toBeNull();
  });

  it('leaderboard API: ?season=2025, without week or live', async () => {
    season2025();
    addGame({ week: 10, kickoff: NOW - 3600_000, status: 'live', score: [7, 0] });
    const res = (await get('/api/leaderboard?season=2025&week=3')).json();
    expect(res).toMatchObject({ season: 2025, seasons: [2026, 2025], week: null, startWeek: 1, live: null });
    expect(res.rows.map((r: { name: string }) => r.name)).toEqual(['Bea', 'Audrey']);
    // Without a parameter: the current season, with live data.
    const now = (await get('/api/leaderboard')).json();
    expect(now.season).toBe(2026);
    expect(now.live).not.toBeNull();
  });

  it('season summary API: ?season=2025', async () => {
    season2025();
    const res = (await get('/api/season?season=2025')).json();
    expect(res).toMatchObject({ season: 2025, seasons: [2026, 2025], finished: true, finalGames: 2 });
    expect(res.rows[0].name).toBe('Bea');
  });

  it('a past season is finished, even without a Super Bowl in the database', async () => {
    addGame({ season: 2025, week: 1, kickoff: NOW - 400 * DAY, score: [10, 20] });
    expect((await get('/api/season?season=2025')).json().finished).toBe(true);
    expect((await get('/api/season')).json().finished).toBe(false);
  });

  it('unknown season: 404', async () => {
    expect((await get('/api/leaderboard?season=1999')).statusCode).toBe(404);
    expect((await get('/api/season?season=abc')).statusCode).toBe(404);
  });
});

describe('starting points per season', () => {
  it('the admin sets them for the current season, other seasons are unchanged', async () => {
    season2025();
    const cookie = await login('Gwen');
    await app.inject({ method: 'PATCH', url: `/api/admin/players/${pid('Audrey')}`, payload: { startPoints: 10 }, headers: { cookie } });
    const rows = (await app.inject({ method: 'GET', url: '/api/admin/players', headers: { cookie } })).json();
    expect(rows.find((p: { name: string }) => p.name === 'Audrey').startPoints).toBe(10);
    expect(standings(undefined, 2025).find((r) => r.name === 'Audrey')!.startPoints).toBe(1);
    setStartPoints(pid('Audrey'), 72); // restored as in the seed
  });
});
