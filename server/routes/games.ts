/** Semaines, matchs, pronos, avant-match et direct. */
import type { FastifyInstance } from 'fastify';
import type { GameDetailDto, LiveDto, OkDto, PreviewDto, Replies, WeekDto, WeeksDto } from '../../shared/api';
import { currentSeason, t, weekLabel } from '../config';
import { db, startWeek } from '../db';
import { fetchLive, fetchPreview } from '../espn';
import { FOREVER, cached } from '../espnCache';
import { pointsFor } from '../scoring';
import { type GameRow, gamesDto, isLocked } from './dto';
import { requireAuth } from './guards';
import { nflStandings, standingOf } from './nfl';

const MIN = 60_000;
const HOUR = 60 * MIN;

export async function gamesRoutes(app: FastifyInstance) {
  app.get<{ Reply: Replies<WeeksDto> }>('/api/weeks', { preHandler: requireAuth }, async () => {
    const rows = db
      .prepare(
        `SELECT week, COUNT(*) AS games, SUM(status = 'final') AS finals, MIN(kickoff) AS first
         FROM games WHERE season = ? GROUP BY week ORDER BY week`
      )
      .all(currentSeason()) as { week: number; games: number; finals: number; first: number }[];
    // Semaine en cours : la première qui a encore un match non terminé.
    const current = rows.find((r) => r.finals < r.games)?.week ?? rows.at(-1)?.week ?? startWeek();
    return {
      season: currentSeason(),
      startWeek: startWeek(),
      current,
      weeks: rows.map((r) => ({ week: r.week, label: weekLabel(r.week), longLabel: weekLabel(r.week, true), points: pointsFor(r.week) }))
    };
  });

  app.get<{ Params: { week: string }; Reply: Replies<WeekDto> }>('/api/weeks/:week', { preHandler: requireAuth }, async (req) => {
    const week = Number(req.params.week);
    const rows = db.prepare('SELECT * FROM games WHERE season = ? AND week = ? ORDER BY kickoff, id').all(currentSeason(), week) as unknown as GameRow[];
    return { week, label: weekLabel(week, true), points: pointsFor(week), games: gamesDto(rows, req.me) };
  });

  app.get<{ Params: { id: string }; Reply: Replies<GameDetailDto> }>('/api/games/:id', { preHandler: requireAuth }, async (req, reply) => {
    const row = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as unknown as GameRow | undefined;
    if (!row) return reply.code(404).send({ error: t.api.gameNotFound });
    const [game] = gamesDto([row], req.me);
    const done = new Set([...game.pickers.away, ...game.pickers.home]);
    const waiting = (db.prepare('SELECT name FROM players ORDER BY name COLLATE NOCASE').all() as { name: string }[])
      .map((p) => p.name)
      .filter((n) => !done.has(n));
    return { ...game, weekLabel: weekLabel(row.week, true), waiting, counted: row.week >= startWeek(row.season) };
  });

  app.put<{ Params: { id: string }; Body: { side?: string }; Reply: Replies<OkDto> }>(
    '/api/picks/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const side = req.body?.side;
      if (side !== 'away' && side !== 'home') return reply.code(400).send({ error: t.api.invalidPick });
      const g = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as unknown as GameRow | undefined;
      if (!g) return reply.code(404).send({ error: t.api.gameNotFound });
      if (isLocked(g)) return reply.code(409).send({ error: t.api.gameStarted });
      db.prepare(
        `INSERT INTO picks (player_id, game_id, side, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(player_id, game_id) DO UPDATE SET side = excluded.side, updated_at = excluded.updated_at`
      ).run(req.me.id, g.id, side, Date.now());
      return { ok: true };
    }
  );

  // Avant-match : bilan, forme, favori et blessés. Frais 20 min ; ensuite on sert l'ancienne version
  // tout de suite et on rafraîchit en arrière-plan.
  app.get<{ Params: { id: string }; Reply: Replies<PreviewDto> }>('/api/games/:id/preview', { preHandler: requireAuth }, async (req, reply) => {
    const game = db.prepare('SELECT id, away_id, home_id FROM games WHERE id = ?').get(req.params.id) as
      | { id: string; away_id: string; home_id: string }
      | undefined;
    if (!game) return reply.code(404).send({ error: t.api.gameNotFound });
    let data;
    try {
      data = await cached(`preview:${game.id}`, () => fetchPreview(game.id), { ttl: 20 * MIN, swr: 6 * HOUR });
    } catch (e) {
      req.log.warn({ err: e }, 'avant-match indisponible');
      return reply.code(502).send({ error: t.api.previewUnavailable });
    }
    // La place au classement est un bonus : si ESPN ne répond pas, l'avant-match s'affiche sans.
    const s = await nflStandings().catch(() => null);
    return { ...data, standing: s ? { away: standingOf(s, game.away_id), home: standingOf(s, game.home_id) } : null };
  });

  // Pendant le match : courbe des chances, actions qui marquent et situation en cours.
  // 25 s pendant le match (tout le monde regarde en même temps) ; 1 h une fois terminé, le temps
  // qu'ESPN corrige ses stats ; puis plus jamais redemandé passé le lendemain.
  app.get<{ Params: { id: string }; Reply: Replies<LiveDto> }>('/api/games/:id/live', { preHandler: requireAuth }, async (req, reply) => {
    const row = db.prepare('SELECT id, week, status, kickoff FROM games WHERE id = ?').get(req.params.id) as
      | { id: string; week: number; status: string; kickoff: number }
      | undefined;
    if (!row) return reply.code(404).send({ error: t.api.gameNotFound });
    if (row.status !== 'live' && row.status !== 'final') return reply.code(409).send({ error: t.api.gameNotStarted });
    const final = row.status === 'final';
    const settled = final && row.kickoff < Date.now() - 24 * HOUR;
    try {
      return await cached(`live:${row.id}:${row.status}`, () => fetchLive(row.id, row.week >= 19), {
        ttl: settled ? FOREVER : final ? HOUR : 25_000,
        swr: final ? 24 * HOUR : MIN
      });
    } catch (e) {
      req.log.warn({ err: e }, 'direct indisponible');
      return reply.code(502).send({ error: t.api.liveUnavailable });
    }
  });
}
