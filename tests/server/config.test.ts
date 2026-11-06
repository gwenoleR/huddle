/**
 * Instance settings from environment variables: name, language, scoring.
 * Read when config.ts loads: set before importing the server.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('web-push', () => ({
  default: { generateVAPIDKeys: () => ({ publicKey: 'pub', privateKey: 'priv' }), setVapidDetails: () => {}, sendNotification: vi.fn() }
}));

process.env.APP_NAME = '  Les Gros Pronos ';
process.env.APP_SHORT_NAME = 'Gros';
process.env.APP_LANG = 'xx'; // unknown language: falls back to French
process.env.POINTS_REGULAR = '2';
process.env.POINTS_PLAYOFFS = '5';

const Fastify = (await import('fastify')).default;
const { routes } = await import('../../server/routes');
const { standings } = await import('../../server/scoring');
const { DAY, NOW, addGame, picks, resetDb } = await import('./helpers');

const app = Fastify();
await app.register(routes);

describe('instance settings', () => {
  it('/api/config: name, language and scoring, without login', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ appName: 'Les Gros Pronos', appShortName: 'Gros', lang: 'fr', points: { regular: 2, playoffs: 5 } });
  });

  it('the installable app manifest carries the instance name', async () => {
    const res = await app.inject({ method: 'GET', url: '/manifest.webmanifest' });
    expect(res.headers['content-type']).toContain('application/manifest+json');
    expect(res.json()).toMatchObject({ name: 'Les Gros Pronos', short_name: 'Gros', lang: 'fr', start_url: '/', display: 'standalone' });
    expect(res.json().icons).toHaveLength(4);
  });

  it('the configured scoring applies to the standings', () => {
    resetDb();
    // Weeks 9+ count in tests (start week 9): one regular-season win, one playoff win.
    const regular = addGame({ week: 10, kickoff: NOW - 3 * DAY, score: [10, 20] }); // KC wins
    const playoff = addGame({ week: 19, kickoff: NOW - 2 * DAY, score: [30, 20] }); // BUF wins
    picks(regular, { Bea: 'home' });
    picks(playoff, { Bea: 'away' });
    const bea = standings().find((r) => r.name === 'Bea')!;
    expect(bea.points - bea.startPoints).toBe(2 + 5);
  });
});

describe('invalid values: defaults are used', () => {
  it('negative, decimal or non-numeric points', async () => {
    vi.resetModules();
    process.env.POINTS_REGULAR = '-1';
    process.env.POINTS_PLAYOFFS = 'two';
    delete process.env.APP_NAME;
    const config = await import('../../server/config');
    expect([config.POINTS_REGULAR, config.POINTS_PLAYOFFS]).toEqual([1, 2]);
    expect(config.APP_NAME).toBe('Prono NFL entre potes');
  });
});
