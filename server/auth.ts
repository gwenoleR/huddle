import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Me } from '../shared/api';
import { COOKIE_SECURE } from './config';

export type { Me };
import { db } from './db';

export const SESSION_COOKIE = 'prono_session';
const SESSION_DAYS = 365;
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(pin, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export const isValidPin = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{4}$/.test(pin);

export function createSession(reply: FastifyReply, playerId: number) {
  const token = randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 24 * 3600_000;
  db.prepare('INSERT INTO sessions (token, player_id, expires_at) VALUES (?, ?, ?)').run(token, playerId, expires);
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: SESSION_DAYS * 24 * 3600
  });
}

export function destroySession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function currentPlayer(req: FastifyRequest): Me | null {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT p.id, p.name, p.is_admin AS isAdmin FROM sessions s JOIN players p ON p.id = s.player_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, Date.now()) as { id: number; name: string; isAdmin: number } | undefined;
  return row ? { id: row.id, name: row.name, isAdmin: !!row.isAdmin } : null;
}

/** Limite par adresse IP, en plus du blocage par prénom : 20 erreurs par heure. */
const ipFailures = new Map<string, { count: number; resetAt: number }>();

export function clientIp(req: FastifyRequest): string {
  return (req.headers['cf-connecting-ip'] as string) ?? req.ip;
}

export function ipBlocked(ip: string): boolean {
  const e = ipFailures.get(ip);
  return !!e && e.resetAt > Date.now() && e.count >= 20;
}

export function recordIpFailure(ip: string) {
  const now = Date.now();
  const e = ipFailures.get(ip);
  if (!e || e.resetAt < now) ipFailures.set(ip, { count: 1, resetAt: now + 3600_000 });
  else e.count++;
}
