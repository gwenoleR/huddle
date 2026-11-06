/**
 * What a self-hoster's setup changes: the version shown and compared by the app, and whether the
 * session cookie requires HTTPS (it follows PUBLIC_URL, so a plain-http LAN test still logs in).
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { defaultDbFile } from '../../server/config';

vi.mock('web-push', () => ({
  default: { generateVAPIDKeys: () => ({ publicKey: 'pub', privateKey: 'priv' }), setVapidDetails: () => {}, sendNotification: vi.fn() }
}));

/** A fresh server with these environment variables. */
async function serverWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  else process.env[k] = v;
  const Fastify = (await import('fastify')).default;
  const cookie = (await import('@fastify/cookie')).default;
  const { routes } = await import('../../server/routes');
  const { db } = await import('../../server/db');
  const app = Fastify();
  await app.register(cookie);
  await app.register(routes);
  const playerId = (db.prepare("SELECT id FROM players WHERE name = 'Gwen'").get() as { id: number }).id;
  const login = () => app.inject({ method: 'POST', url: '/api/login', payload: { playerId, pin: '1234' } });
  return { app, login };
}

describe('version', () => {
  it('/api/health gives the whole version, not a truncated one', async () => {
    const { app } = await serverWith({ APP_VERSION: '1.2.0-edge.abc1234' });
    expect((await app.inject({ method: 'GET', url: '/api/health' })).json()).toEqual({ ok: true, version: '1.2.0-edge.abc1234' });
  });

  it('no version: "dev"', async () => {
    const { app } = await serverWith({ APP_VERSION: undefined });
    expect((await app.inject({ method: 'GET', url: '/api/health' })).json().version).toBe('dev');
  });
});

describe('session cookie', () => {
  it('HTTPS address: the cookie is Secure', async () => {
    const { login } = await serverWith({ PUBLIC_URL: 'https://prono.example.com', COOKIE_SECURE: undefined });
    expect((await login()).headers['set-cookie']).toMatch(/; Secure/);
  });

  it('plain http on the LAN: not Secure, otherwise browsers would drop it and nobody could log in', async () => {
    const { login } = await serverWith({ PUBLIC_URL: 'http://192.168.1.10:3000', COOKIE_SECURE: undefined });
    const res = await login();
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).not.toMatch(/; Secure/);
  });

  it('COOKIE_SECURE overrides it', async () => {
    const { login } = await serverWith({ PUBLIC_URL: 'http://192.168.1.10:3000', COOKIE_SECURE: 'true' });
    expect((await login()).headers['set-cookie']).toMatch(/; Secure/);
  });
});

describe('database file', () => {
  it('a new install uses huddle.db', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'huddle-db-'));
    expect(defaultDbFile(dir)).toBe(path.join(dir, 'huddle.db'));
  });

  it('an install from before the rename keeps its prono.db', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'huddle-db-'));
    writeFileSync(path.join(dir, 'prono.db'), '');
    expect(defaultDbFile(dir)).toBe(path.join(dir, 'prono.db'));
  });
});
