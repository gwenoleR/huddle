/** Administration: players, PINs, history and ESPN sync. */
import type { FastifyInstance } from 'fastify';
import type { AdminPlayerDto, HistoryImportDto, OkDto, Replies, SyncStatusDto } from '../../shared/api';
import { db, setStartPoints } from '../db';
import { currentSeason, t } from '../config';
import { espnStats } from '../espn';
import { importHistory, parseHistory } from '../history';
import { forceSync, syncStatus } from '../sync';
import { requireAdmin } from './guards';

export async function adminRoutes(app: FastifyInstance) {
  app.get<{ Reply: Replies<AdminPlayerDto[]> }>('/api/admin/players', { preHandler: requireAdmin }, async () =>
    // Starting points: those of the current season.
    (db
      .prepare(
        `SELECT p.id, p.name, COALESCE(ps.start_points, 0) AS startPoints, p.is_admin AS isAdmin, p.pin_hash IS NOT NULL AS hasPin
         FROM players p LEFT JOIN player_seasons ps ON ps.player_id = p.id AND ps.season = ? ORDER BY p.name`
      )
      .all(currentSeason()) as {
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
    if (!name || name.length > 30) return reply.code(400).send({ error: t.api.invalidName });
    try {
      const { lastInsertRowid } = db.prepare('INSERT INTO players (name, created_at) VALUES (?, ?)').run(name, Date.now());
      if (startPoints) setStartPoints(Number(lastInsertRowid), startPoints);
    } catch {
      return reply.code(409).send({ error: t.api.nameTaken });
    }
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Reply: Replies<OkDto> }>('/api/admin/players/:id/reset-pin', { preHandler: requireAdmin }, async (req) => {
    const id = Number(req.params.id);
    db.prepare('UPDATE players SET pin_hash = NULL, failed_attempts = 0, locked_until = 0 WHERE id = ?').run(id);
    db.prepare('DELETE FROM sessions WHERE player_id = ?').run(id);
    return { ok: true };
  });

  app.patch<{ Params: { id: string }; Body: { name?: string; isAdmin?: boolean; startPoints?: number }; Reply: Replies<OkDto> }>(
    '/api/admin/players/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!db.prepare('SELECT 1 FROM players WHERE id = ?').get(id)) return reply.code(404).send({ error: t.api.unknownPlayer });
      const { name, isAdmin, startPoints } = req.body ?? {};
      if (name !== undefined) {
        const n = String(name).trim();
        if (!n || n.length > 30) return reply.code(400).send({ error: t.api.invalidName });
        try {
          db.prepare('UPDATE players SET name = ? WHERE id = ?').run(n, id);
        } catch {
          return reply.code(409).send({ error: t.api.nameTaken });
        }
      }
      if (isAdmin !== undefined) {
        // You can't revoke your own rights: the group always keeps at least one admin.
        if (!isAdmin && id === req.me.id) return reply.code(400).send({ error: t.api.cannotRevokeOwnAdmin });
        db.prepare('UPDATE players SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, id);
      }
      if (startPoints !== undefined) {
        const pts = Number(startPoints);
        if (!Number.isInteger(pts) || pts < 0 || pts > 999) return reply.code(400).send({ error: t.api.invalidStartPoints });
        setStartPoints(id, pts);
      }
      return { ok: true };
    }
  );

  // Deletes the player and everything that goes with it (picks, bonus, sessions, notifications: ON DELETE CASCADE).
  app.delete<{ Params: { id: string }; Reply: Replies<OkDto> }>('/api/admin/players/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const id = Number(req.params.id);
    if (id === req.me.id) return reply.code(400).send({ error: t.api.cannotDeleteSelf });
    const { changes } = db.prepare('DELETE FROM players WHERE id = ?').run(id);
    if (!changes) return reply.code(404).send({ error: t.api.unknownPlayer });
    return { ok: true };
  });

  // History from another site, as CSV: first a dry run (dryRun) to check, then for real.
  app.post<{ Body: { csv?: string; dryRun?: boolean }; Reply: Replies<HistoryImportDto> }>(
    '/api/admin/history',
    { preHandler: requireAdmin, bodyLimit: 2 * 1024 * 1024 },
    async (req, reply) => {
      const dryRun = req.body?.dryRun === true;
      try {
        const r = importHistory(parseHistory(String(req.body?.csv ?? '')), { dryRun });
        if (!dryRun) console.log(`[history] ${r.picks} picks imported over ${r.games} games (${r.players.join(', ')})`);
        return { ...r, dryRun };
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
    }
  );

  const status = (): SyncStatusDto => ({ ...syncStatus(), espn: espnStats() });

  app.get<{ Reply: Replies<SyncStatusDto> }>('/api/admin/sync', { preHandler: requireAdmin }, async () => status());

  // On failure, the sync status comes with the error (the admin screen shows it).
  app.post<{ Reply: SyncStatusDto | (SyncStatusDto & { error: string }) }>('/api/admin/sync', { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      await forceSync();
      return status();
    } catch {
      return reply.code(502).send({ error: t.api.syncFailed(syncStatus().message), ...status() });
    }
  });
}
