/** Connexion par prénom + code à 4 chiffres, avec blocage après trop d'essais. */
import type { FastifyInstance } from 'fastify';
import type { HealthDto, Me, OkDto, PlayerLite, Replies } from '../../shared/api';
import { LOCK_MINUTES, MAX_ATTEMPTS, clientIp, createSession, destroySession, hashPin, ipBlocked, isValidPin, recordIpFailure, verifyPin } from '../auth';
import { db } from '../db';
import { requireAuth } from './guards';

interface PlayerRow {
  id: number;
  pin_hash: string | null;
  failed_attempts: number;
  locked_until: number;
}

export async function authRoutes(app: FastifyInstance) {
  app.get<{ Reply: HealthDto }>('/api/health', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    return { ok: true, version: (process.env.APP_VERSION ?? 'dev').slice(0, 7) };
  });

  app.get<{ Reply: PlayerLite[] }>('/api/players', async () =>
    (db.prepare('SELECT id, name, pin_hash IS NOT NULL AS hasPin FROM players ORDER BY name COLLATE NOCASE').all() as {
      id: number;
      name: string;
      hasPin: number;
    }[]).map((p) => ({ id: p.id, name: p.name, hasPin: !!p.hasPin }))
  );

  // Premier lancement, base vide : le premier venu crée le groupe et en devient l'admin.
  app.post<{ Body: { name?: string; pin?: string }; Reply: Replies<OkDto> }>('/api/setup', async (req, reply) => {
    const name = String(req.body?.name ?? '').trim();
    const pin = req.body?.pin;
    if (!name || name.length > 30) return reply.code(400).send({ error: 'Prénom invalide.' });
    if (!isValidPin(pin)) return reply.code(400).send({ error: 'Le code fait 4 chiffres.' });
    if (db.prepare('SELECT 1 FROM players LIMIT 1').get()) return reply.code(409).send({ error: 'Le groupe existe déjà : connecte-toi.' });
    const { lastInsertRowid } = db
      .prepare('INSERT INTO players (name, is_admin, pin_hash, created_at) VALUES (?, 1, ?, ?)')
      .run(name, hashPin(pin), Date.now());
    createSession(reply, Number(lastInsertRowid));
    return { ok: true, created: true };
  });

  app.post<{ Body: { playerId?: number; pin?: string }; Reply: Replies<OkDto> }>('/api/login', async (req, reply) => {
    const ip = clientIp(req);
    if (ipBlocked(ip)) return reply.code(429).send({ error: 'Trop d’essais depuis cette connexion, réessaie dans une heure.' });

    const { playerId, pin } = req.body ?? {};
    if (!isValidPin(pin)) return reply.code(400).send({ error: 'Le code fait 4 chiffres.' });
    const p = db.prepare('SELECT id, pin_hash, failed_attempts, locked_until FROM players WHERE id = ?').get(Number(playerId)) as
      | PlayerRow
      | undefined;
    if (!p) return reply.code(404).send({ error: 'Joueur inconnu.' });

    const now = Date.now();
    if (p.locked_until > now) {
      const min = Math.ceil((p.locked_until - now) / 60_000);
      return reply.code(429).send({ error: `Trop d’essais. Réessaie dans ${min} min.`, retryInMinutes: min });
    }

    // Première connexion : le code tapé devient celui du joueur.
    if (!p.pin_hash) {
      db.prepare('UPDATE players SET pin_hash = ?, failed_attempts = 0 WHERE id = ?').run(hashPin(pin), p.id);
      createSession(reply, p.id);
      return { ok: true, created: true };
    }

    if (!verifyPin(pin, p.pin_hash)) {
      recordIpFailure(ip);
      const attempts = p.failed_attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        db.prepare('UPDATE players SET failed_attempts = 0, locked_until = ? WHERE id = ?').run(now + LOCK_MINUTES * 60_000, p.id);
        return reply.code(429).send({ error: `Trop d’essais. Réessaie dans ${LOCK_MINUTES} min.`, retryInMinutes: LOCK_MINUTES });
      }
      db.prepare('UPDATE players SET failed_attempts = ? WHERE id = ?').run(attempts, p.id);
      const left = MAX_ATTEMPTS - attempts;
      return reply.code(401).send({ error: `Code incorrect. Encore ${left} essai${left > 1 ? 's' : ''}.`, attemptsLeft: left });
    }

    db.prepare('UPDATE players SET failed_attempts = 0, locked_until = 0 WHERE id = ?').run(p.id);
    createSession(reply, p.id);
    return { ok: true };
  });

  app.post<{ Reply: OkDto }>('/api/logout', async (req, reply) => {
    destroySession(req, reply);
    return { ok: true };
  });

  app.get<{ Reply: Replies<Me> }>('/api/me', { preHandler: requireAuth }, async (req) => req.me);
}
