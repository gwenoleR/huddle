/**
 * The API as phones call it (requests simulated by Fastify, no network).
 * ESPN and notification sending are replaced by test doubles.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('web-push', () => ({
  default: { generateVAPIDKeys: () => ({ publicKey: 'pub', privateKey: 'priv' }), setVapidDetails: () => {}, sendNotification: vi.fn() }
}));
vi.mock('../../server/espn', async (orig) => ({
  ...(await orig<typeof import('../../server/espn')>()),
  fetchPreview: vi.fn(),
  fetchLive: vi.fn(),
  fetchStandings: vi.fn()
}));

const Fastify = (await import('fastify')).default;
const cookie = (await import('@fastify/cookie')).default;
const { routes } = await import('../../server/routes');
const espn = await import('../../server/espn');
const { DAY, HOUR, NOW, TEAMS, addGame, db, pick, picks, pid, resetDb, setMeta } = await import('./helpers');

type App = Awaited<ReturnType<typeof build>>;
async function build() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(routes);
  return app;
}

let app: App;
let ipSeq = 0;
/** Each test has its own IP address, so PIN errors don't add up from one test to the next. */
let ip = '';

beforeEach(async () => {
  resetDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(espn.fetchPreview).mockReset();
  vi.mocked(espn.fetchLive).mockReset();
  vi.mocked(espn.fetchStandings).mockReset();
  ip = `10.0.0.${++ipSeq}`;
  app = await build();
});
afterEach(async () => {
  vi.useRealTimers();
  await app.close();
});

const loginRaw = (name: string, pin: string) =>
  app.inject({ method: 'POST', url: '/api/login', payload: { playerId: pid(name), pin }, headers: { 'cf-connecting-ip': ip } });

/** Logs in (the first PIN typed becomes the player's) and returns the session cookie. */
async function login(name: string, pin = '1234') {
  const res = await loginRaw(name, pin);
  expect(res.statusCode).toBe(200);
  const c = res.cookies.find((x) => x.name === 'prono_session')!;
  return { cookie: `${c.name}=${c.value}` };
}

const get = (url: string, as?: { cookie: string }) => app.inject({ method: 'GET', url, headers: as ? { cookie: as.cookie } : {} });
const put = (url: string, payload: object, as: { cookie: string }) => app.inject({ method: 'PUT', url, payload, headers: { cookie: as.cookie } });

describe('login', () => {
  it('the first PIN typed becomes the player\'s', async () => {
    const res = await loginRaw('Bea', '4321');
    expect(res.json()).toEqual({ ok: true, created: true });
    expect((await loginRaw('Bea', '4321')).json()).toEqual({ ok: true });
  });

  it('rejects a PIN that is not 4 digits, or an unknown player', async () => {
    expect((await loginRaw('Bea', '12a4')).statusCode).toBe(400);
    expect((await loginRaw('Bea', '12345')).statusCode).toBe(400);
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { playerId: 999, pin: '1234' } });
    expect(res.statusCode).toBe(404);
  });

  it('locks for 15 minutes after 5 wrong PINs, even with the right PIN', async () => {
    await login('Bea', '1111');
    for (let left = 4; left >= 1; left--) {
      const res = await loginRaw('Bea', '0000');
      expect(res.statusCode).toBe(401);
      expect(res.json().attemptsLeft).toBe(left);
    }
    const locked = await loginRaw('Bea', '0000');
    expect(locked.statusCode).toBe(429);
    expect(locked.json().retryInMinutes).toBe(15);
    expect((await loginRaw('Bea', '1111')).statusCode).toBe(429);

    vi.setSystemTime(NOW + 16 * 60_000);
    expect((await loginRaw('Bea', '1111')).statusCode).toBe(200);
  });

  it('blocks a connection that piles up 20 errors in an hour, across all players', async () => {
    for (const name of ['Bea', 'Bud', 'Audrey', 'Max', 'Gwen']) await login(name, '1111');
    for (let i = 0; i < 20; i++) await loginRaw(['Bea', 'Bud', 'Audrey', 'Max', 'Gwen'][i % 5], '0000');
    const res = await loginRaw('Gwen', '1111');
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toContain('depuis cette connexion');
  });

  it('without session: 401; without admin rights: 403', async () => {
    expect((await get('/api/me')).statusCode).toBe(401);
    const bea = await login('Bea');
    expect((await get('/api/me', bea)).json()).toEqual({ id: pid('Bea'), name: 'Bea', isAdmin: false });
    expect((await get('/api/admin/players', bea)).statusCode).toBe(403);
    expect((await get('/api/admin/players', await login('Gwen'))).statusCode).toBe(200);
  });

  it('logout invalidates the session', async () => {
    const bea = await login('Bea');
    await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie: bea.cookie } });
    expect((await get('/api/me', bea)).statusCode).toBe(401);
  });

  it('the admin can reset a player\'s PIN, which logs them out', async () => {
    const bea = await login('Bea', '1111');
    const gwen = await login('Gwen');
    await app.inject({ method: 'POST', url: `/api/admin/players/${pid('Bea')}/reset-pin`, headers: { cookie: gwen.cookie } });
    expect((await get('/api/me', bea)).statusCode).toBe(401);
    expect((await loginRaw('Bea', '2222')).json().created).toBe(true);
  });
});

describe('picks', () => {
  it('can pick, then change one\'s mind before kickoff', async () => {
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW + HOUR });
    expect((await put(`/api/picks/${g}`, { side: 'away' }, bea)).json()).toEqual({ ok: true });
    expect((await put(`/api/picks/${g}`, { side: 'home' }, bea)).statusCode).toBe(200);
    const game = (await get(`/api/games/${g}`, bea)).json();
    expect(game).toMatchObject({ myPick: 'home', locked: false, pickers: { away: [], home: ['Bea'] }, counted: true });
    expect(game.waiting).toEqual(['Audrey', 'Bud', 'Gwen', 'Max']);
  });

  it('rejects a pick after kickoff, even if the sync has not yet seen the game start', async () => {
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW - 60_000 });
    const res = await put(`/api/picks/${g}`, { side: 'away' }, bea);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('Trop tard, le match a commencé.');
  });

  it('rejects a pick on a live or postponed game, or one before the start week', async () => {
    const bea = await login('Bea');
    for (const g of [
      addGame({ week: 10, kickoff: NOW + HOUR, status: 'live' }),
      addGame({ week: 10, kickoff: NOW + HOUR, status: 'postponed' }),
      addGame({ week: 8, kickoff: NOW + HOUR })
    ])
      expect((await put(`/api/picks/${g}`, { side: 'away' }, bea)).statusCode).toBe(409);
  });

  it('rejects an unknown side or a non-existent game', async () => {
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW + HOUR });
    expect((await put(`/api/picks/${g}`, { side: 'draw' }, bea)).statusCode).toBe(400);
    expect((await put('/api/picks/unknown', { side: 'away' }, bea)).statusCode).toBe(404);
  });

  it('the week lists games with my pick, the others\' picks and the points at stake', async () => {
    const bea = await login('Bea');
    const g = addGame({ week: 19, kickoff: NOW + HOUR, away: 'SF', home: 'PHI' });
    picks(g, { Bea: 'away', Gwen: 'home', Audrey: 'away' });
    const w = (await get('/api/weeks/19', bea)).json();
    expect(w).toMatchObject({ week: 19, label: 'Wild Card', points: 2 });
    expect(w.games[0]).toMatchObject({ myPick: 'away', points: 2, away: { abbr: 'SF', name: '49ers' }, home: { abbr: 'PHI' } });
    expect(w.games[0].pickers.away.sort()).toEqual(['Audrey', 'Bea']);
  });

  it('current week: the first one with a game not yet final', async () => {
    addGame({ week: 9, score: [1, 0] });
    addGame({ week: 10, kickoff: NOW + DAY });
    addGame({ week: 11, kickoff: NOW + 8 * DAY });
    const w = (await get('/api/weeks', await login('Bea'))).json();
    expect(w).toMatchObject({ current: 10, startWeek: 9, season: 2026 });
  });
});

describe('leaderboard and profile', () => {
  it('the leaderboard includes the live projection during games', async () => {
    picks(addGame({ week: 10, status: 'live', score: [7, 0] }), { Max: 'away' });
    const l = (await get('/api/leaderboard', await login('Bea'))).json();
    expect(l.live.rows.find((r: any) => r.name === 'Max')).toMatchObject({ points: 64, projected: 65 });
    const week = (await get('/api/leaderboard?week=10', await login('Bea'))).json();
    expect(week.live).toBeNull();
  });

  it('profile: rank, points, streak', async () => {
    const g = addGame({ week: 10, score: [7, 0] });
    pick('Max', g, 'away');
    const p = (await get('/api/profile', await login('Max'))).json();
    expect(p).toMatchObject({ name: 'Max', rank: 5, points: 65, startPoints: 64, good: 1, played: 1, streak: 1, players: 5 });
  });

  it('recap: 404 until a game is final', async () => {
    expect((await get('/api/recap', await login('Bea'))).statusCode).toBe(404);
  });
});

describe('end-of-season bonus', () => {
  const FIELD = {
    afc: [TEAMS.BUF, TEAMS.KC, TEAMS.BAL, TEAMS.PIT].map((t, i) => ({ teamId: t.id, seed: i + 1 })),
    nfc: [TEAMS.SF, TEAMS.PHI, TEAMS.DET, TEAMS.DAL].map((t, i) => ({ teamId: t.id, seed: i + 1 }))
  };
  const open = () => {
    setMeta('bonus_field:2026', JSON.stringify(FIELD));
    addGame({ week: 19, kickoff: NOW + DAY });
  };
  const valid = { afc: 'BUF', nfc: 'SF', sb: 'BUF', sbTotal: 47 };

  it('rejects picks until it is open', async () => {
    expect((await put('/api/bonus', valid, await login('Bea'))).statusCode).toBe(409);
  });

  it('saves valid picks', async () => {
    open();
    const bea = await login('Bea');
    expect((await put('/api/bonus', valid, bea)).json()).toEqual({ ok: true });
    const b = (await get('/api/bonus', bea)).json();
    expect(b).toMatchObject({ phase: 'open', mine: { afc: { abbr: 'BUF' }, sb: { abbr: 'BUF' }, sbTotal: 47 } });
    expect(b.field.afc[0]).toMatchObject({ seed: 1, team: { abbr: 'BUF' } });
  });

  it.each([
    [{ ...valid, afc: 'SF' }, 'champion AFC'],
    [{ ...valid, afc: 'DAL' }, 'champion AFC'],
    [{ ...valid, nfc: 'XXX' }, 'champion NFC'],
    [{ ...valid, sb: 'KC' }, 'un de tes deux champions'],
    [{ ...valid, sbTotal: -1 }, 'entre 0 et 200'],
    [{ ...valid, sbTotal: 201 }, 'entre 0 et 200'],
    [{ ...valid, sbTotal: 4.5 }, 'entre 0 et 200']
  ])('rejects %o', async (body, message) => {
    open();
    const res = await put('/api/bonus', body, await login('Bea'));
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain(message);
  });

  it('before the reveal: shows who picked, not what', async () => {
    open();
    const bea = await login('Bea');
    await put('/api/bonus', valid, bea);
    vi.setSystemTime(NOW + DAY + 1); // Wild Card started
    db.prepare('UPDATE games SET status = ? WHERE week = 19').run('live');
    // Revealed at the Super Bowl, not yet scheduled.
    await put('/api/admin/bonus', { reveal: 'superbowl' }, await login('Gwen'));
    const b = (await get('/api/bonus', await login('Audrey'))).json();
    expect(b).toMatchObject({ phase: 'locked', revealed: false });
    expect(b.players.find((p: any) => p.name === 'Bea')).toEqual({ name: 'Bea', done: true, pick: null, points: null });
    expect(b.players.find((p: any) => p.name === 'Audrey')).toMatchObject({ done: false });
  });

  it('after the reveal: everyone\'s picks and points', async () => {
    open();
    const bea = await login('Bea');
    await put('/api/bonus', valid, bea);
    vi.setSystemTime(NOW + DAY + 1);
    setMeta('bonus_result:2026', JSON.stringify({ afc: TEAMS.BUF.id, nfc: null, sb: null, sbTotal: null }));
    const b = (await get('/api/bonus', bea)).json();
    expect(b.revealed).toBe(true);
    expect(b.players.find((p: any) => p.name === 'Bea')).toMatchObject({ done: true, pick: { afc: { abbr: 'BUF' } }, points: 3 });
  });

  it('admin settings: validates points and reveal', async () => {
    const gwen = await login('Gwen');
    expect((await put('/api/admin/bonus', { points: { sb: 6 } }, gwen)).json()).toEqual({
      enabled: true,
      points: { afc: 3, nfc: 3, sb: 6 },
      reveal: 'wildcard'
    });
    expect((await put('/api/admin/bonus', { points: { afc: 51 } }, gwen)).statusCode).toBe(400);
    expect((await put('/api/admin/bonus', { points: { afc: 1.5 } }, gwen)).statusCode).toBe(400);
    expect((await put('/api/admin/bonus', { reveal: 'tomorrow' }, gwen)).statusCode).toBe(400);
    expect((await put('/api/admin/bonus', { enabled: false }, gwen)).json().enabled).toBe(false);
    expect((await put('/api/admin/bonus', { enabled: true }, await login('Bea'))).statusCode).toBe(403);
  });
});

describe('on-demand ESPN data', () => {
  const preview = { away: {}, home: {}, odds: null } as never;
  const live = { winProb: [], length: 3600, scoring: [], stats: [], leaders: [], situation: null } as never;

  it('preview: a single ESPN call for several visits within 20 min', async () => {
    vi.mocked(espn.fetchPreview).mockResolvedValue(preview);
    vi.mocked(espn.fetchStandings).mockRejectedValue(new Error('ESPN down'));
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW + DAY });
    expect((await get(`/api/games/${g}/preview`, bea)).json()).toMatchObject({ odds: null, standing: null });
    await get(`/api/games/${g}/preview`, bea);
    expect(espn.fetchPreview).toHaveBeenCalledTimes(1);
    vi.setSystemTime(NOW + 21 * 60_000);
    await get(`/api/games/${g}/preview`, bea);
    expect(espn.fetchPreview).toHaveBeenCalledTimes(2);
  });

  it('preview: if ESPN goes down, serves the last known version', async () => {
    vi.mocked(espn.fetchPreview).mockResolvedValueOnce(preview).mockRejectedValue(new Error('outage'));
    vi.mocked(espn.fetchStandings).mockRejectedValue(new Error('outage'));
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW + DAY });
    await get(`/api/games/${g}/preview`, bea);
    vi.setSystemTime(NOW + HOUR);
    expect((await get(`/api/games/${g}/preview`, bea)).statusCode).toBe(200);
    const other = addGame({ week: 10, kickoff: NOW + DAY });
    expect((await get(`/api/games/${other}/preview`, bea)).statusCode).toBe(502);
  });

  it('live: 409 before kickoff, 25 s cache during the game', async () => {
    vi.mocked(espn.fetchLive).mockResolvedValue(live);
    const bea = await login('Bea');
    expect((await get(`/api/games/${addGame({ kickoff: NOW + HOUR })}/live`, bea)).statusCode).toBe(409);
    const g = addGame({ week: 19, status: 'live', score: [7, 0] });
    await get(`/api/games/${g}/live`, bea);
    vi.setSystemTime(NOW + 20_000);
    await get(`/api/games/${g}/live`, bea);
    expect(espn.fetchLive).toHaveBeenCalledTimes(1);
    expect(espn.fetchLive).toHaveBeenCalledWith(g, true); // playoffs: 15-min overtime
    vi.setSystemTime(NOW + 30_000);
    await get(`/api/games/${g}/live`, bea);
    expect(espn.fetchLive).toHaveBeenCalledTimes(2);
  });

  it('live: at the final whistle, fetches the final stats right away', async () => {
    vi.mocked(espn.fetchLive).mockResolvedValue(live);
    const bea = await login('Bea');
    const g = addGame({ week: 10, status: 'live', score: [7, 0] });
    await get(`/api/games/${g}/live`, bea);
    db.prepare("UPDATE games SET status = 'final', winner = 'away' WHERE id = ?").run(g);
    await get(`/api/games/${g}/live`, bea);
    expect(espn.fetchLive).toHaveBeenCalledTimes(2);
  });

  it('live: a game finished since the day before is never requested from ESPN again', async () => {
    vi.mocked(espn.fetchLive).mockResolvedValue(live);
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW - 2 * DAY, score: [7, 0] });
    await get(`/api/games/${g}/live`, bea);
    vi.setSystemTime(NOW + 300 * DAY);
    await get(`/api/games/${g}/live`, bea);
    expect(espn.fetchLive).toHaveBeenCalledTimes(1);
  });

  it('admin: sync status also gives the number of ESPN calls', async () => {
    const s = (await get('/api/admin/sync', await login('Gwen'))).json();
    expect(s.espn).toEqual({ lastHour: 0, lastDay: 0, errorsLastHour: 0, pausedUntil: null });
  });

  it('NFL standings: teams from the database and sorted seeds', async () => {
    const team = (id: string, seed: number, divRank: number) => ({ teamId: id, record: '5-3', streak: null, seed, diff: null, divRecord: null, divRank, clinch: null });
    vi.mocked(espn.fetchStandings).mockResolvedValue({
      conferences: [
        { abbr: 'AFC', divisions: [{ name: 'AFC East', teams: [team(TEAMS.KC.id, 3, 1), team(TEAMS.BUF.id, 1, 2), team('999', 9, 3)] }] }
      ]
    });
    const s = (await get('/api/nfl/standings', await login('Bea'))).json();
    expect(s.conferences[0].divisions[0].teams).toHaveLength(2); // unknown team ignored
    expect(s.conferences[0].seeds.map((t: any) => [t.team.abbr, t.seed, t.division])).toEqual([
      ['BUF', 1, 'AFC East'],
      ['KC', 3, 'AFC East']
    ]);
  });
});

describe('team page', () => {
  it('record, schedule and what the group did with that team', async () => {
    vi.mocked(espn.fetchStandings).mockRejectedValue(new Error('outage'));
    const g1 = addGame({ week: 10, away: 'BUF', home: 'KC', score: [24, 17] });
    const g2 = addGame({ week: 11, away: 'DAL', home: 'BUF', score: [30, 10] });
    addGame({ week: 12, away: 'BUF', home: 'PIT', kickoff: NOW + DAY });
    picks(g1, { Bea: 'away', Gwen: 'home' });
    picks(g2, { Bea: 'home' });
    const t = (await get('/api/teams/buf', await login('Bea'))).json();
    expect(t).toMatchObject({ record: '1-1', standing: null, team: { abbr: 'BUF' } });
    expect(t.schedule.map((g: any) => [g.week, g.opponent.abbr, g.home, g.result ?? null])).toEqual([
      [10, 'KC', false, 'W'],
      [11, 'DAL', true, 'L'],
      [12, 'PIT', false, null]
    ]);
    expect(t.band.find((b: any) => b.name === 'Bea')).toMatchObject({ with: 2, withGood: 1, against: 0 });
    expect(t.band.find((b: any) => b.name === 'Gwen')).toMatchObject({ with: 0, against: 1, againstGood: 0 });
  });

  it('404 for an unknown team', async () => {
    expect((await get('/api/teams/xyz', await login('Bea'))).statusCode).toBe(404);
  });
});
