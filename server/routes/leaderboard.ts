/** Classement de la bande, récap de la semaine, profil et bilan de saison. */
import type { FastifyInstance } from 'fastify';
import type { LeaderboardDto, ProfileDto, RecapDto, Replies, SeasonDto } from '../../shared/api';
import { SEASON, START_WEEK } from '../config';
import { db } from '../db';
import { awards, latestRecapWeek, liveProjection, recap, standings, streak, weeklyResults } from '../scoring';
import { requireAuth } from './guards';

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { week?: string }; Reply: Replies<LeaderboardDto> }>('/api/leaderboard', { preHandler: requireAuth }, async (req) => {
    const week = req.query.week ? Number(req.query.week) : undefined;
    // En saison, pendant les matchs : projection « si ça finit comme ça ».
    return { week: week ?? null, startWeek: START_WEEK, rows: standings(week), live: week ? null : liveProjection() };
  });

  app.get<{ Querystring: { week?: string }; Reply: Replies<RecapDto> }>('/api/recap', { preHandler: requireAuth }, async (req, reply) => {
    const week = req.query.week ? Number(req.query.week) : latestRecapWeek();
    if (!week) return reply.code(404).send({ error: 'Pas encore de match terminé.' });
    return recap(week);
  });

  app.get<{ Reply: Replies<ProfileDto> }>('/api/profile', { preHandler: requireAuth }, async (req) => {
    const rows = standings();
    const me = rows.find((r) => r.id === req.me.id)!;
    return {
      ...req.me,
      season: SEASON,
      startWeek: START_WEEK,
      players: rows.length,
      rank: me.rank,
      points: me.points,
      startPoints: me.startPoints,
      good: me.good,
      played: me.played,
      streak: streak(req.me.id),
      weeks: weeklyResults(req.me.id)
    };
  });

  app.get<{ Reply: Replies<SeasonDto> }>('/api/season', { preHandler: requireAuth }, async () => {
    const sb = db.prepare('SELECT status FROM games WHERE season = ? AND week = 22').get(SEASON) as { status: string } | undefined;
    const games = db.prepare("SELECT COUNT(*) AS n FROM games WHERE season = ? AND week >= ? AND status = 'final'").get(SEASON, START_WEEK) as {
      n: number;
    };
    return { season: SEASON, startWeek: START_WEEK, finished: sb?.status === 'final', finalGames: games.n, rows: standings(), awards: awards() };
  });
}
