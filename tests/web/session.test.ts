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

/** The server answers every request with this status. */
const server = (status: number, body: object = {}) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

describe('lost session', () => {
  it('a 401 on an app page sends back to login', async () => {
    server(401, { error: 'Connecte-toi d’abord' });
    await expect(api('/weeks/10')).rejects.toBeInstanceOf(ApiError);
    expect(lost).toBe(1);
  });

  it('a wrong PIN at login is not a lost session', async () => {
    server(401, { error: 'Code incorrect. Encore 4 essais.' });
    await expect(api('/login', { method: 'POST', body: { playerId: 1, pin: '0000' } })).rejects.toThrow('Code incorrect');
    expect(lost).toBe(0);
  });

  it('neither is the startup check (it already leads to login)', async () => {
    server(401);
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError);
    expect(lost).toBe(0);
  });

  it('other rejections do not log out', async () => {
    for (const status of [403, 404, 409, 500]) {
      server(status, { error: 'no' });
      await expect(api('/picks/g1', { method: 'PUT', body: { side: 'away' } })).rejects.toBeInstanceOf(ApiError);
    }
    expect(lost).toBe(0);
  });

  it('a normal response does not log out', async () => {
    server(200, { ok: true });
    expect(await api('/profile')).toEqual({ ok: true });
    expect(lost).toBe(0);
  });

  it('no network: clear message, without logging out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api('/weeks')).rejects.toMatchObject({ status: 0, message: 'Pas de réseau. Réessaie dans un instant.' });
    expect(lost).toBe(0);
  });

  it('rule alone', () => {
    expect(endsSession('/leaderboard', 401)).toBe(true);
    expect(endsSession('/login', 401)).toBe(false);
    expect(endsSession('/me', 401)).toBe(false);
    expect(endsSession('/leaderboard', 403)).toBe(false);
  });
});
