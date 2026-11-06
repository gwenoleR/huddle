/**
 * Plusieurs saisons dans la même base : la saison en cours change toute seule le 1er juin, et les
 * saisons passées restent consultables (classement, bilan) avec leurs propres points de départ.
 * Dans les tests, la saison en cours est 2026, reprise en semaine 9 (tests/fixtures/seed.json).
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

/** Saison 2025 : Bea et Audrey ont joué, les autres pas encore arrivés. */
function season2025() {
  const g1 = addGame({ season: 2025, week: 3, kickoff: NOW - 400 * DAY, score: [10, 20] }); // KC gagne
  const g2 = addGame({ season: 2025, week: 22, kickoff: NOW - 300 * DAY, score: [30, 20], away: 'SF', home: 'BUF' }); // Super Bowl, SF gagne
  pick('Bea', g1, 'home');
  pick('Bea', g2, 'away');
  pick('Audrey', g1, 'away');
  setStartPoints(pid('Audrey'), 1, 2025);
}

describe('saison en cours', () => {
  it('suit la date si rien ne la fige : nouvelle saison le 1er juin', () => {
    const pinned = process.env.SEASON;
    delete process.env.SEASON;
    try {
      expect(currentSeason(Date.parse('2027-02-08T00:00:00Z'))).toBe(2026);
      expect(currentSeason(Date.parse('2027-06-01T00:00:00Z'))).toBe(2027);
    } finally {
      process.env.SEASON = pinned;
    }
  });

  it('chaque saison a sa première semaine comptée (la reprise en S9 ne vaut que pour 2026)', () => {
    expect(startWeek(2026)).toBe(9);
    expect(startWeek(2025)).toBe(1);
  });

  it('saisons consultables : celles qui ont des matchs, plus la saison en cours, la plus récente d’abord', () => {
    expect(knownSeasons()).toEqual([2026]);
    season2025();
    expect(knownSeasons()).toEqual([2026, 2025]);
  });
});

describe('saison passée', () => {
  it('classement : ses pronos, ses points de départ, et seulement ceux qui y ont joué', () => {
    season2025();
    const rows = standings(undefined, 2025);
    expect(rows.map((r) => [r.name, r.points, r.startPoints])).toEqual([
      ['Bea', 3, 0], // 1 + 2 (Super Bowl)
      ['Audrey', 1, 1]
    ]);
  });

  it('n’entre pas dans la saison en cours', () => {
    season2025();
    const now = Object.fromEntries(standings().map((r) => [r.name, r.points]));
    expect(now).toEqual({ Gwen: 73, Audrey: 72, Bea: 71, Bud: 69, Max: 64 }); // les points de départ 2026, rien de 2025
  });

  it('trophées calculés sur la saison demandée', () => {
    season2025();
    const best = awards(2025).find((a) => a.id === 'best-week')!;
    expect(best.who).toBe('Bea');
    expect(awards().find((a) => a.id === 'best-week')!.who).toBeNull();
  });

  it('API classement : ?season=2025, sans semaine ni direct', async () => {
    season2025();
    addGame({ week: 10, kickoff: NOW - 3600_000, status: 'live', score: [7, 0] });
    const res = (await get('/api/leaderboard?season=2025&week=3')).json();
    expect(res).toMatchObject({ season: 2025, seasons: [2026, 2025], week: null, startWeek: 1, live: null });
    expect(res.rows.map((r: { name: string }) => r.name)).toEqual(['Bea', 'Audrey']);
    // Sans paramètre : la saison en cours, avec le direct.
    const now = (await get('/api/leaderboard')).json();
    expect(now.season).toBe(2026);
    expect(now.live).not.toBeNull();
  });

  it('API bilan : ?season=2025', async () => {
    season2025();
    const res = (await get('/api/season?season=2025')).json();
    expect(res).toMatchObject({ season: 2025, seasons: [2026, 2025], finished: true, finalGames: 2 });
    expect(res.rows[0].name).toBe('Bea');
  });

  it('une saison passée est terminée, même sans Super Bowl en base', async () => {
    addGame({ season: 2025, week: 1, kickoff: NOW - 400 * DAY, score: [10, 20] });
    expect((await get('/api/season?season=2025')).json().finished).toBe(true);
    expect((await get('/api/season')).json().finished).toBe(false);
  });

  it('saison inconnue : 404', async () => {
    expect((await get('/api/leaderboard?season=1999')).statusCode).toBe(404);
    expect((await get('/api/season?season=abc')).statusCode).toBe(404);
  });
});

describe('points de départ par saison', () => {
  it('l’admin les règle pour la saison en cours, les autres saisons ne bougent pas', async () => {
    season2025();
    const cookie = await login('Gwen');
    await app.inject({ method: 'PATCH', url: `/api/admin/players/${pid('Audrey')}`, payload: { startPoints: 10 }, headers: { cookie } });
    const rows = (await app.inject({ method: 'GET', url: '/api/admin/players', headers: { cookie } })).json();
    expect(rows.find((p: { name: string }) => p.name === 'Audrey').startPoints).toBe(10);
    expect(standings(undefined, 2025).find((r) => r.name === 'Audrey')!.startPoints).toBe(1);
    setStartPoints(pid('Audrey'), 72); // remis comme dans le seed
  });
});
