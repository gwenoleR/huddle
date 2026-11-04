// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, SESSION_LOST, api, endsSession } from '../../web/src/lib/api';

let lost = 0;
const onLost = () => lost++;
beforeEach(() => {
  lost = 0;
  addEventListener(SESSION_LOST, onLost);
});
afterEach(() => {
  removeEventListener(SESSION_LOST, onLost);
  vi.unstubAllGlobals();
});

/** Le serveur répond ce code à tout. */
const server = (status: number, body: object = {}) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

describe('session perdue', () => {
  it('un 401 sur une page de l’appli renvoie à la connexion', async () => {
    server(401, { error: 'Connecte-toi d’abord' });
    await expect(api('/weeks/10')).rejects.toBeInstanceOf(ApiError);
    expect(lost).toBe(1);
  });

  it('un mauvais code à la connexion n’est pas une session perdue', async () => {
    server(401, { error: 'Code incorrect. Encore 4 essais.' });
    await expect(api('/login', { method: 'POST', body: { playerId: 1, pin: '0000' } })).rejects.toThrow('Code incorrect');
    expect(lost).toBe(0);
  });

  it('la vérification au démarrage non plus (elle mène déjà à la connexion)', async () => {
    server(401);
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError);
    expect(lost).toBe(0);
  });

  it('les autres refus ne déconnectent pas', async () => {
    for (const status of [403, 404, 409, 500]) {
      server(status, { error: 'non' });
      await expect(api('/picks/g1', { method: 'PUT', body: { side: 'away' } })).rejects.toBeInstanceOf(ApiError);
    }
    expect(lost).toBe(0);
  });

  it('une réponse normale ne déconnecte pas', async () => {
    server(200, { ok: true });
    expect(await api('/profile')).toEqual({ ok: true });
    expect(lost).toBe(0);
  });

  it('pas de réseau : message clair, sans déconnecter', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api('/weeks')).rejects.toMatchObject({ status: 0, message: 'Pas de réseau. Réessaie dans un instant.' });
    expect(lost).toBe(0);
  });

  it('règle seule', () => {
    expect(endsSession('/leaderboard', 401)).toBe(true);
    expect(endsSession('/login', 401)).toBe(false);
    expect(endsSession('/me', 401)).toBe(false);
    expect(endsSession('/leaderboard', 403)).toBe(false);
  });
});
