/**
 * A fresh install: no seed file, empty database. The first visitor creates the group,
 * then the admin manages players and imports the history from the app.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('web-push', () => ({
  default: { generateVAPIDKeys: () => ({ publicKey: 'pub', privateKey: 'priv' }), setVapidDetails: () => {}, sendNotification: vi.fn() }
}));

// Read when config.ts and db.ts load: must be removed before importing the server.
delete process.env.SEED_FILE;
delete process.env.START_WEEK;
const Fastify = (await import('fastify')).default;
const cookie = (await import('@fastify/cookie')).default;
const { routes } = await import('../../server/routes');
const { seasonAt } = await import('../../server/config');
const { startWeek } = await import('../../server/db');
const { DAY, NOW, addGame, db, pick, resetDb } = await import('./helpers');

const app = Fastify();
await app.register(cookie);
await app.register(routes);

const sessionOf = (res: { cookies: { name: string; value: string }[] }) => {
  const c = res.cookies.find((x) => x.name === 'prono_session')!;
  return `${c.name}=${c.value}`;
};
const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie?: string, payload?: object) =>
  app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });
const idOf = (name: string) => (db.prepare('SELECT id FROM players WHERE name = ?').get(name) as { id: number } | undefined)?.id;

let admin = '';

describe('fresh install', () => {
  beforeAll(() => resetDb());

  it('without seed: no players, and the whole season counts', async () => {
    expect((await call('GET', '/api/players')).json()).toEqual([]);
    expect(startWeek()).toBe(1);
  });

  it('season by date: the previous one stays until end of May, the new one arrives on June 1', () => {
    expect(seasonAt(Date.parse('2026-09-10T00:00:00Z'))).toBe(2026);
    expect(seasonAt(Date.parse('2027-02-07T00:00:00Z'))).toBe(2026); // Super Bowl
    expect(seasonAt(Date.parse('2027-05-31T12:00:00Z'))).toBe(2026);
    expect(seasonAt(Date.parse('2027-06-01T00:00:00Z'))).toBe(2027);
  });

  it('validates the name and PIN', async () => {
    expect((await call('POST', '/api/setup', undefined, { name: ' ', pin: '1234' })).statusCode).toBe(400);
    expect((await call('POST', '/api/setup', undefined, { name: 'Léa', pin: '12' })).statusCode).toBe(400);
    expect((await call('POST', '/api/players')).statusCode).toBe(404);
  });

  it('the first visitor creates the group, becomes its admin and stays logged in', async () => {
    const res = await call('POST', '/api/setup', undefined, { name: ' Léa ', pin: '4321' });
    expect(res.json()).toEqual({ ok: true, created: true });
    admin = sessionOf(res);
    expect((await call('GET', '/api/me', admin)).json()).toMatchObject({ name: 'Léa', isAdmin: true });
    expect((await call('GET', '/api/players')).json()).toEqual([{ id: idOf('Léa'), name: 'Léa', hasPin: true }]);
  });

  it('afterwards, nobody can create the group again', async () => {
    const res = await call('POST', '/api/setup', undefined, { name: 'Intrus', pin: '0000' });
    expect(res.statusCode).toBe(409);
    expect(idOf('Intrus')).toBeUndefined();
  });

  it('the PIN chosen at creation is used to log in again', async () => {
    expect((await call('POST', '/api/login', undefined, { playerId: idOf('Léa'), pin: '4321' })).statusCode).toBe(200);
  });
});

describe('player management', () => {
  it('add, rename, make admin, change starting points', async () => {
    expect((await call('POST', '/api/admin/players', admin, { name: 'Tom' })).statusCode).toBe(200);
    await call('POST', '/api/admin/players', admin, { name: 'Max' });
    const tom = idOf('Tom')!;
    expect((await call('PATCH', `/api/admin/players/${tom}`, admin, { name: 'Thomas', isAdmin: true, startPoints: 12 })).statusCode).toBe(200);
    const rows = (await call('GET', '/api/admin/players', admin)).json();
    expect(rows.find((p: { id: number }) => p.id === tom)).toEqual({ id: tom, name: 'Thomas', startPoints: 12, isAdmin: true, hasPin: false });
  });

  it('rejects a taken name, invalid points, an unknown player', async () => {
    const tom = idOf('Thomas')!;
    expect((await call('PATCH', `/api/admin/players/${tom}`, admin, { name: 'max' })).statusCode).toBe(409);
    expect((await call('PATCH', `/api/admin/players/${tom}`, admin, { startPoints: -1 })).statusCode).toBe(400);
    expect((await call('PATCH', `/api/admin/players/${tom}`, admin, { startPoints: 2.5 })).statusCode).toBe(400);
    expect((await call('PATCH', '/api/admin/players/9999', admin, { name: 'X' })).statusCode).toBe(404);
  });

  it('the admin can neither revoke their own rights nor delete themselves', async () => {
    const lea = idOf('Léa')!;
    expect((await call('PATCH', `/api/admin/players/${lea}`, admin, { isAdmin: false })).statusCode).toBe(400);
    expect((await call('DELETE', `/api/admin/players/${lea}`, admin)).statusCode).toBe(400);
    expect((await call('GET', '/api/me', admin)).json().isAdmin).toBe(true);
  });

  it('deleting a player erases their picks and logs them out', async () => {
    const max = idOf('Max')!;
    const g = addGame({ week: 3, kickoff: NOW - 30 * DAY, score: [10, 20] });
    pick('Max', g, 'home');
    const login = await call('POST', '/api/login', undefined, { playerId: max, pin: '1111' });
    const maxSession = sessionOf(login);
    expect((await call('DELETE', `/api/admin/players/${max}`, admin)).json()).toEqual({ ok: true });
    expect(idOf('Max')).toBeUndefined();
    expect((db.prepare('SELECT COUNT(*) AS n FROM picks WHERE player_id = ?').get(max) as { n: number }).n).toBe(0);
    expect((await call('GET', '/api/me', maxSession)).statusCode).toBe(401);
    expect((await call('DELETE', `/api/admin/players/${max}`, admin)).statusCode).toBe(404);
  });

  it('admin only', async () => {
    const tom = idOf('Thomas')!;
    await call('PATCH', `/api/admin/players/${tom}`, admin, { isAdmin: false });
    const t = sessionOf(await call('POST', '/api/login', undefined, { playerId: tom, pin: '2222' }));
    expect((await call('DELETE', `/api/admin/players/${idOf('Léa')}`, t)).statusCode).toBe(403);
    expect((await call('POST', '/api/admin/history', t, { csv: '' })).statusCode).toBe(403);
  });
});

describe('history import from the app', () => {
  const CSV = ',Home,Away,Prono LE,Prono TH\nWeek1,KC Chiefs,BUF Bills,KC Chiefs,BUF Bills';

  it('dry run first, nothing is written', async () => {
    addGame({ id: 'h1', week: 1, away: 'BUF', home: 'KC', kickoff: NOW - 60 * DAY, score: [20, 27] });
    const res = await call('POST', '/api/admin/history', admin, { csv: CSV, dryRun: true });
    expect(res.json()).toEqual({ games: 1, picks: 2, players: ['Léa', 'Thomas'], dryRun: true });
    expect((db.prepare("SELECT COUNT(*) AS n FROM picks WHERE game_id = 'h1'").get() as { n: number }).n).toBe(0);
  });

  it('then for real', async () => {
    const res = await call('POST', '/api/admin/history', admin, { csv: CSV });
    expect(res.json()).toMatchObject({ picks: 2, dryRun: false });
    expect((db.prepare("SELECT COUNT(*) AS n FROM picks WHERE game_id = 'h1'").get() as { n: number }).n).toBe(2);
  });

  it('a mismatching file: 400 with the list of problems', async () => {
    const res = await call('POST', '/api/admin/history', admin, { csv: CSV.replace('Prono TH', 'Prono ZZ') });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('joueur « ZZ » inconnu');
    expect((await call('POST', '/api/admin/history', admin, { csv: '' })).json().error).toContain('Fichier vide');
  });
});
