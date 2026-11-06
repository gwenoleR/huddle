/**
 * An instance in English (APP_LANG=en): what the server sends — settings, API errors, live game
 * details — comes from the English dictionary. Read when config.ts loads: set before importing.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('web-push', () => ({
  default: { generateVAPIDKeys: () => ({ publicKey: 'pub', privateKey: 'priv' }), setVapidDetails: () => {}, sendNotification: vi.fn() }
}));

process.env.APP_LANG = 'en';
delete process.env.APP_NAME;

const Fastify = (await import('fastify')).default;
const cookie = (await import('@fastify/cookie')).default;
const { routes } = await import('../../server/routes');
const { t, weekLabel } = await import('../../server/config');
const { messages } = await import('../../shared/i18n');
const { pid, resetDb } = await import('./helpers');

const app = Fastify();
await app.register(cookie);
await app.register(routes);

describe('English instance', () => {
  it('/api/config says English, and the manifest too', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/config' })).json()).toMatchObject({ lang: 'en', appName: 'Huddle' });
    expect((await app.inject({ method: 'GET', url: '/manifest.webmanifest' })).json().lang).toBe('en');
  });

  it('API errors are in English', async () => {
    resetDb();
    const payload = { playerId: pid('Gwen'), pin: '1234' };
    await app.inject({ method: 'POST', url: '/api/login', payload }); // first PIN becomes the PIN
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { ...payload, pin: '0000' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe(t.api.wrongPin(4));
    expect(res.json().error).not.toBe(messages('fr').api.wrongPin(4));
  });

  it('week labels', () => {
    expect([weekLabel(9), weekLabel(9, true), weekLabel(22)]).toEqual(['W9', 'Week 9', 'Super Bowl']);
  });

  it('the late-game check reads the English game details', () => {
    expect(t.espn.detail.isLate(t.espn.detail.running(4, '2:00'))).toBe(true);
    expect(t.espn.detail.isLate(t.espn.detail.endOfPeriod(4))).toBe(true);
    expect(t.espn.detail.isLate(t.espn.detail.running(5, '7:00'))).toBe(true);
    expect(t.espn.detail.isLate(t.espn.detail.running(3, '2:00'))).toBe(false);
    expect(t.espn.detail.isLate(t.espn.detail.halftime)).toBe(false);
  });
});

describe('English words', () => {
  const en = messages('en');

  it('ordinals and plurals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(en.common.ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st'
    ]);
    expect([en.common.pronos(1), en.common.pronos(2), en.common.matches(1), en.common.points(2)]).toEqual(['1 pick', '2 picks', '1 game', '2 pts']);
  });

  it('every dictionary has the same keys as the French one', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
    const fr = messages('fr');
    // bodyParts / directions / scoreKinds are lookup tables of ESPN values: their keys may differ.
    const skip = (k: string) => /^espn\.(bodyParts|directions|scoreKinds)\./.test(k);
    expect(keys(en).filter((k) => !skip(k)).sort()).toEqual(keys(fr).filter((k) => !skip(k)).sort());
  });
});
