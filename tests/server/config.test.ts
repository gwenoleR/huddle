/**
 * Réglages de l'instance par variables d'environnement : nom, langue, barème.
 * Lus au chargement de config.ts : posés avant d'importer le serveur.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('web-push', () => ({
  default: { generateVAPIDKeys: () => ({ publicKey: 'pub', privateKey: 'priv' }), setVapidDetails: () => {}, sendNotification: vi.fn() }
}));

process.env.APP_NAME = '  Les Gros Pronos ';
process.env.APP_SHORT_NAME = 'Gros';
process.env.APP_LANG = 'xx'; // langue inconnue : le français
process.env.POINTS_REGULAR = '2';
process.env.POINTS_PLAYOFFS = '5';

const Fastify = (await import('fastify')).default;
const { routes } = await import('../../server/routes');
const { standings } = await import('../../server/scoring');
const { DAY, NOW, addGame, picks, resetDb } = await import('./helpers');

const app = Fastify();
await app.register(routes);

describe('réglages de l’instance', () => {
  it('/api/config : nom, langue et barème, sans connexion', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ appName: 'Les Gros Pronos', appShortName: 'Gros', lang: 'fr', points: { regular: 2, playoffs: 5 } });
  });

  it('le manifeste de l’appli installable porte le nom de l’instance', async () => {
    const res = await app.inject({ method: 'GET', url: '/manifest.webmanifest' });
    expect(res.headers['content-type']).toContain('application/manifest+json');
    expect(res.json()).toMatchObject({ name: 'Les Gros Pronos', short_name: 'Gros', lang: 'fr', start_url: '/', display: 'standalone' });
    expect(res.json().icons).toHaveLength(4);
  });

  it('le barème réglé compte au classement', () => {
    resetDb();
    // Semaines 9+ comptées dans les tests (reprise en S9) : une victoire en saison régulière, une en playoffs.
    const regular = addGame({ week: 10, kickoff: NOW - 3 * DAY, score: [10, 20] }); // KC gagne
    const playoff = addGame({ week: 19, kickoff: NOW - 2 * DAY, score: [30, 20] }); // BUF gagne
    picks(regular, { Bea: 'home' });
    picks(playoff, { Bea: 'away' });
    const bea = standings().find((r) => r.name === 'Bea')!;
    expect(bea.points - bea.startPoints).toBe(2 + 5);
  });
});

describe('valeurs invalides : celles par défaut', () => {
  it('points négatifs, à virgule ou pas des nombres', async () => {
    vi.resetModules();
    process.env.POINTS_REGULAR = '-1';
    process.env.POINTS_PLAYOFFS = 'deux';
    delete process.env.APP_NAME;
    const config = await import('../../server/config');
    expect([config.POINTS_REGULAR, config.POINTS_PLAYOFFS]).toEqual([1, 2]);
    expect(config.APP_NAME).toBe('Prono NFL entre potes');
  });
});
