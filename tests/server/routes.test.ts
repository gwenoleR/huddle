/**
 * L'API telle que les téléphones l'appellent (requêtes simulées par Fastify, sans réseau).
 * ESPN et l'envoi des notifications sont remplacés par des doublures.
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
/** Chaque test a sa propre adresse IP, pour ne pas cumuler les erreurs de code d'un test à l'autre. */
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

/** Se connecte (le premier code tapé devient celui du joueur) et renvoie le cookie de session. */
async function login(name: string, pin = '1234') {
  const res = await loginRaw(name, pin);
  expect(res.statusCode).toBe(200);
  const c = res.cookies.find((x) => x.name === 'prono_session')!;
  return { cookie: `${c.name}=${c.value}` };
}

const get = (url: string, as?: { cookie: string }) => app.inject({ method: 'GET', url, headers: as ? { cookie: as.cookie } : {} });
const put = (url: string, payload: object, as: { cookie: string }) => app.inject({ method: 'PUT', url, payload, headers: { cookie: as.cookie } });

describe('connexion', () => {
  it('le premier code tapé devient celui du joueur', async () => {
    const res = await loginRaw('Bea', '4321');
    expect(res.json()).toEqual({ ok: true, created: true });
    expect((await loginRaw('Bea', '4321')).json()).toEqual({ ok: true });
  });

  it('refuse un code qui n’a pas 4 chiffres, ou un joueur inconnu', async () => {
    expect((await loginRaw('Bea', '12a4')).statusCode).toBe(400);
    expect((await loginRaw('Bea', '12345')).statusCode).toBe(400);
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { playerId: 999, pin: '1234' } });
    expect(res.statusCode).toBe(404);
  });

  it('bloque 15 minutes après 5 mauvais codes, même avec le bon code', async () => {
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

  it('bloque une connexion qui accumule 20 erreurs en une heure, tous joueurs confondus', async () => {
    for (const name of ['Bea', 'Bud', 'Audrey', 'Max', 'Gwen']) await login(name, '1111');
    for (let i = 0; i < 20; i++) await loginRaw(['Bea', 'Bud', 'Audrey', 'Max', 'Gwen'][i % 5], '0000');
    const res = await loginRaw('Gwen', '1111');
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toContain('depuis cette connexion');
  });

  it('sans session : 401 ; sans être admin : 403', async () => {
    expect((await get('/api/me')).statusCode).toBe(401);
    const bea = await login('Bea');
    expect((await get('/api/me', bea)).json()).toEqual({ id: pid('Bea'), name: 'Bea', isAdmin: false });
    expect((await get('/api/admin/players', bea)).statusCode).toBe(403);
    expect((await get('/api/admin/players', await login('Gwen'))).statusCode).toBe(200);
  });

  it('la déconnexion invalide la session', async () => {
    const bea = await login('Bea');
    await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie: bea.cookie } });
    expect((await get('/api/me', bea)).statusCode).toBe(401);
  });

  it('l’admin peut remettre à zéro le code d’un joueur, ce qui le déconnecte', async () => {
    const bea = await login('Bea', '1111');
    const gwen = await login('Gwen');
    await app.inject({ method: 'POST', url: `/api/admin/players/${pid('Bea')}/reset-pin`, headers: { cookie: gwen.cookie } });
    expect((await get('/api/me', bea)).statusCode).toBe(401);
    expect((await loginRaw('Bea', '2222')).json().created).toBe(true);
  });
});

describe('pronos', () => {
  it('on peut pronostiquer puis changer d’avis avant le coup d’envoi', async () => {
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW + HOUR });
    expect((await put(`/api/picks/${g}`, { side: 'away' }, bea)).json()).toEqual({ ok: true });
    expect((await put(`/api/picks/${g}`, { side: 'home' }, bea)).statusCode).toBe(200);
    const game = (await get(`/api/games/${g}`, bea)).json();
    expect(game).toMatchObject({ myPick: 'home', locked: false, pickers: { away: [], home: ['Bea'] }, counted: true });
    expect(game.waiting).toEqual(['Audrey', 'Bud', 'Gwen', 'Max']);
  });

  it('refuse un prono après le coup d’envoi, même si la synchro n’a pas encore vu le match commencer', async () => {
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW - 60_000 });
    const res = await put(`/api/picks/${g}`, { side: 'away' }, bea);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('Trop tard, le match a commencé.');
  });

  it('refuse un prono sur un match en cours, reporté ou d’avant la reprise', async () => {
    const bea = await login('Bea');
    for (const g of [
      addGame({ week: 10, kickoff: NOW + HOUR, status: 'live' }),
      addGame({ week: 10, kickoff: NOW + HOUR, status: 'postponed' }),
      addGame({ week: 8, kickoff: NOW + HOUR })
    ])
      expect((await put(`/api/picks/${g}`, { side: 'away' }, bea)).statusCode).toBe(409);
  });

  it('refuse un côté inconnu ou un match inexistant', async () => {
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW + HOUR });
    expect((await put(`/api/picks/${g}`, { side: 'nul' }, bea)).statusCode).toBe(400);
    expect((await put('/api/picks/inconnu', { side: 'away' }, bea)).statusCode).toBe(404);
  });

  it('la semaine liste les matchs avec mon prono, ceux des autres et les points en jeu', async () => {
    const bea = await login('Bea');
    const g = addGame({ week: 19, kickoff: NOW + HOUR, away: 'SF', home: 'PHI' });
    picks(g, { Bea: 'away', Gwen: 'home', Audrey: 'away' });
    const w = (await get('/api/weeks/19', bea)).json();
    expect(w).toMatchObject({ week: 19, label: 'Wild Card', points: 2 });
    expect(w.games[0]).toMatchObject({ myPick: 'away', points: 2, away: { abbr: 'SF', name: '49ers' }, home: { abbr: 'PHI' } });
    expect(w.games[0].pickers.away.sort()).toEqual(['Audrey', 'Bea']);
  });

  it('semaine en cours : la première avec un match pas terminé', async () => {
    addGame({ week: 9, score: [1, 0] });
    addGame({ week: 10, kickoff: NOW + DAY });
    addGame({ week: 11, kickoff: NOW + 8 * DAY });
    const w = (await get('/api/weeks', await login('Bea'))).json();
    expect(w).toMatchObject({ current: 10, startWeek: 9, season: 2026 });
  });
});

describe('classement et profil', () => {
  it('le classement inclut la projection en direct pendant les matchs', async () => {
    picks(addGame({ week: 10, status: 'live', score: [7, 0] }), { Max: 'away' });
    const l = (await get('/api/leaderboard', await login('Bea'))).json();
    expect(l.live.rows.find((r: any) => r.name === 'Max')).toMatchObject({ points: 64, projected: 65 });
    const week = (await get('/api/leaderboard?week=10', await login('Bea'))).json();
    expect(week.live).toBeNull();
  });

  it('profil : rang, points, série', async () => {
    const g = addGame({ week: 10, score: [7, 0] });
    pick('Max', g, 'away');
    const p = (await get('/api/profile', await login('Max'))).json();
    expect(p).toMatchObject({ name: 'Max', rank: 5, points: 65, startPoints: 64, good: 1, played: 1, streak: 1, players: 5 });
  });

  it('récap : 404 tant qu’aucun match n’est terminé', async () => {
    expect((await get('/api/recap', await login('Bea'))).statusCode).toBe(404);
  });
});

describe('bonus de fin de saison', () => {
  const FIELD = {
    afc: [TEAMS.BUF, TEAMS.KC, TEAMS.BAL, TEAMS.PIT].map((t, i) => ({ teamId: t.id, seed: i + 1 })),
    nfc: [TEAMS.SF, TEAMS.PHI, TEAMS.DET, TEAMS.DAL].map((t, i) => ({ teamId: t.id, seed: i + 1 }))
  };
  const open = () => {
    setMeta('bonus_field:2026', JSON.stringify(FIELD));
    addGame({ week: 19, kickoff: NOW + DAY });
  };
  const valid = { afc: 'BUF', nfc: 'SF', sb: 'BUF', sbTotal: 47 };

  it('refuse les choix tant que ce n’est pas ouvert', async () => {
    expect((await put('/api/bonus', valid, await login('Bea'))).statusCode).toBe(409);
  });

  it('enregistre des choix valides', async () => {
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
  ])('refuse %o', async (body, message) => {
    open();
    const res = await put('/api/bonus', body, await login('Bea'));
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain(message);
  });

  it('avant la révélation : on voit qui a choisi, pas quoi', async () => {
    open();
    const bea = await login('Bea');
    await put('/api/bonus', valid, bea);
    vi.setSystemTime(NOW + DAY + 1); // Wild Card commencée
    db.prepare('UPDATE games SET status = ? WHERE week = 19').run('live');
    // Révélation au Super Bowl, pas encore au calendrier.
    await put('/api/admin/bonus', { reveal: 'superbowl' }, await login('Gwen'));
    const b = (await get('/api/bonus', await login('Audrey'))).json();
    expect(b).toMatchObject({ phase: 'locked', revealed: false });
    expect(b.players.find((p: any) => p.name === 'Bea')).toEqual({ name: 'Bea', done: true, pick: null, points: null });
    expect(b.players.find((p: any) => p.name === 'Audrey')).toMatchObject({ done: false });
  });

  it('après la révélation : les choix et points de chacun', async () => {
    open();
    const bea = await login('Bea');
    await put('/api/bonus', valid, bea);
    vi.setSystemTime(NOW + DAY + 1);
    setMeta('bonus_result:2026', JSON.stringify({ afc: TEAMS.BUF.id, nfc: null, sb: null, sbTotal: null }));
    const b = (await get('/api/bonus', bea)).json();
    expect(b.revealed).toBe(true);
    expect(b.players.find((p: any) => p.name === 'Bea')).toMatchObject({ done: true, pick: { afc: { abbr: 'BUF' } }, points: 3 });
  });

  it('réglages admin : valide les points et la révélation', async () => {
    const gwen = await login('Gwen');
    expect((await put('/api/admin/bonus', { points: { sb: 6 } }, gwen)).json()).toEqual({
      enabled: true,
      points: { afc: 3, nfc: 3, sb: 6 },
      reveal: 'wildcard'
    });
    expect((await put('/api/admin/bonus', { points: { afc: 51 } }, gwen)).statusCode).toBe(400);
    expect((await put('/api/admin/bonus', { points: { afc: 1.5 } }, gwen)).statusCode).toBe(400);
    expect((await put('/api/admin/bonus', { reveal: 'demain' }, gwen)).statusCode).toBe(400);
    expect((await put('/api/admin/bonus', { enabled: false }, gwen)).json().enabled).toBe(false);
    expect((await put('/api/admin/bonus', { enabled: true }, await login('Bea'))).statusCode).toBe(403);
  });
});

describe('données ESPN à la demande', () => {
  const preview = { away: {}, home: {}, odds: null } as never;
  const live = { winProb: [], length: 3600, scoring: [], stats: [], leaders: [], situation: null } as never;

  it('avant-match : un seul appel ESPN pour plusieurs visites en 20 min', async () => {
    vi.mocked(espn.fetchPreview).mockResolvedValue(preview);
    vi.mocked(espn.fetchStandings).mockRejectedValue(new Error('ESPN en panne'));
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW + DAY });
    expect((await get(`/api/games/${g}/preview`, bea)).json()).toMatchObject({ odds: null, standing: null });
    await get(`/api/games/${g}/preview`, bea);
    expect(espn.fetchPreview).toHaveBeenCalledTimes(1);
    vi.setSystemTime(NOW + 21 * 60_000);
    await get(`/api/games/${g}/preview`, bea);
    expect(espn.fetchPreview).toHaveBeenCalledTimes(2);
  });

  it('avant-match : si ESPN tombe, on ressert la dernière version connue', async () => {
    vi.mocked(espn.fetchPreview).mockResolvedValueOnce(preview).mockRejectedValue(new Error('panne'));
    vi.mocked(espn.fetchStandings).mockRejectedValue(new Error('panne'));
    const bea = await login('Bea');
    const g = addGame({ week: 10, kickoff: NOW + DAY });
    await get(`/api/games/${g}/preview`, bea);
    vi.setSystemTime(NOW + HOUR);
    expect((await get(`/api/games/${g}/preview`, bea)).statusCode).toBe(200);
    const other = addGame({ week: 10, kickoff: NOW + DAY });
    expect((await get(`/api/games/${other}/preview`, bea)).statusCode).toBe(502);
  });

  it('direct : 409 avant le coup d’envoi, cache de 25 s pendant le match', async () => {
    vi.mocked(espn.fetchLive).mockResolvedValue(live);
    const bea = await login('Bea');
    expect((await get(`/api/games/${addGame({ kickoff: NOW + HOUR })}/live`, bea)).statusCode).toBe(409);
    const g = addGame({ week: 19, status: 'live', score: [7, 0] });
    await get(`/api/games/${g}/live`, bea);
    vi.setSystemTime(NOW + 20_000);
    await get(`/api/games/${g}/live`, bea);
    expect(espn.fetchLive).toHaveBeenCalledTimes(1);
    expect(espn.fetchLive).toHaveBeenCalledWith(g, true); // playoffs : prolongation de 15 min
    vi.setSystemTime(NOW + 30_000);
    await get(`/api/games/${g}/live`, bea);
    expect(espn.fetchLive).toHaveBeenCalledTimes(2);
  });

  it('classement NFL : équipes de la base et têtes de série triées', async () => {
    const team = (id: string, seed: number, divRank: number) => ({ teamId: id, record: '5-3', streak: null, seed, diff: null, divRecord: null, divRank, clinch: null });
    vi.mocked(espn.fetchStandings).mockResolvedValue({
      conferences: [
        { abbr: 'AFC', divisions: [{ name: 'AFC Est', teams: [team(TEAMS.KC.id, 3, 1), team(TEAMS.BUF.id, 1, 2), team('999', 9, 3)] }] }
      ]
    });
    const s = (await get('/api/nfl/standings', await login('Bea'))).json();
    expect(s.conferences[0].divisions[0].teams).toHaveLength(2); // équipe inconnue ignorée
    expect(s.conferences[0].seeds.map((t: any) => [t.team.abbr, t.seed, t.division])).toEqual([
      ['BUF', 1, 'AFC Est'],
      ['KC', 3, 'AFC Est']
    ]);
  });
});

describe('fiche équipe', () => {
  it('bilan, calendrier et ce que la bande a fait avec elle', async () => {
    vi.mocked(espn.fetchStandings).mockRejectedValue(new Error('panne'));
    const g1 = addGame({ week: 10, away: 'BUF', home: 'KC', score: [24, 17] });
    const g2 = addGame({ week: 11, away: 'DAL', home: 'BUF', score: [30, 10] });
    addGame({ week: 12, away: 'BUF', home: 'PIT', kickoff: NOW + DAY });
    picks(g1, { Bea: 'away', Gwen: 'home' });
    picks(g2, { Bea: 'home' });
    const t = (await get('/api/teams/buf', await login('Bea'))).json();
    expect(t).toMatchObject({ record: '1-1', standing: null, team: { abbr: 'BUF' } });
    expect(t.schedule.map((g: any) => [g.week, g.opponent.abbr, g.home, g.result ?? null])).toEqual([
      [10, 'KC', false, 'V'],
      [11, 'DAL', true, 'D'],
      [12, 'PIT', false, null]
    ]);
    expect(t.bande.find((b: any) => b.name === 'Bea')).toMatchObject({ with: 2, withGood: 1, against: 0 });
    expect(t.bande.find((b: any) => b.name === 'Gwen')).toMatchObject({ with: 0, against: 1, againstGood: 0 });
  });

  it('404 pour une équipe inconnue', async () => {
    expect((await get('/api/teams/xyz', await login('Bea'))).statusCode).toBe(404);
  });
});
