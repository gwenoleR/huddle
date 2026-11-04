/** Administration : joueurs, codes et synchro ESPN. */
import type { FastifyInstance } from 'fastify';
import type { AdminPlayerDto, OkDto, Replies, SyncStatusDto } from '../../shared/api';
import { db } from '../db';
import { espnStats } from '../espn';
import { forceSync, syncStatus } from '../sync';
import { requireAdmin } from './guards';

export async function adminRoutes(app: FastifyInstance) {
  app.get<{ Reply: Replies<AdminPlayerDto[]> }>('/api/admin/players', { preHandler: requireAdmin }, async () =>
    (db.prepare('SELECT id, name, start_points AS startPoints, is_admin AS isAdmin, pin_hash IS NOT NULL AS hasPin FROM players ORDER BY name').all() as {
      id: number;
      name: string;
      startPoints: number;
      isAdmin: number;
      hasPin: number;
    }[]).map((p) => ({ ...p, isAdmin: !!p.isAdmin, hasPin: !!p.hasPin }))
  );

  app.post<{ Body: { name?: string; startPoints?: number }; Reply: Replies<OkDto> }>('/api/admin/players', { preHandler: requireAdmin }, async (req, reply) => {
    const name = String(req.body?.name ?? '').trim();
    const startPoints = Math.max(0, Math.round(Number(req.body?.startPoints ?? 0)));
    if (!name || name.length > 30) return reply.code(400).send({ error: 'Prénom invalide.' });
    try {
      db.prepare('INSERT INTO players (name, start_points, created_at) VALUES (?, ?, ?)').run(name, startPoints, Date.now());
    } catch {
      return reply.code(409).send({ error: 'Ce prénom existe déjà.' });
    }
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Reply: Replies<OkDto> }>('/api/admin/players/:id/reset-pin', { preHandler: requireAdmin }, async (req) => {
    const id = Number(req.params.id);
    db.prepare('UPDATE players SET pin_hash = NULL, failed_attempts = 0, locked_until = 0 WHERE id = ?').run(id);
    db.prepare('DELETE FROM sessions WHERE player_id = ?').run(id);
    return { ok: true };
  });

  const status = (): SyncStatusDto => ({ ...syncStatus(), espn: espnStats() });

  app.get<{ Reply: Replies<SyncStatusDto> }>('/api/admin/sync', { preHandler: requireAdmin }, async () => status());

  // En cas d'échec, l'état de la synchro accompagne l'erreur (l'écran admin l'affiche).
  app.post<{ Reply: SyncStatusDto | (SyncStatusDto & { error: string }) }>('/api/admin/sync', { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      await forceSync();
      return status();
    } catch {
      return reply.code(502).send({ error: `Synchro impossible : ${syncStatus().message}`, ...status() });
    }
  });
}
