/** Group leaderboard, weekly recap, profile and season recap. */
import type { FastifyInstance } from 'fastify';
import type { LeaderboardDto, ProfileDto, RecapDto, Replies, SeasonDto } from '../../shared/api';
import { currentSeason, t } from '../config';
import { db, knownSeasons, startWeek } from '../db';
import { awards, latestRecapWeek, liveProjection, recap, standings, streak, weeklyResults } from '../scoring';
import { requireAuth } from './guards';

/** ?season=2025: a past season; without the parameter, the current season. null if the season is unknown. */
function seasonParam(raw: string | undefined): number | null {
  if (!raw) return currentSeason();
  const s = Number(raw);
  return knownSeasons().includes(s) ? s : null;
}

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { week?: string; season?: string }; Reply: Replies<LeaderboardDto> }>(
    '/api/leaderboard',
    { preHandler: requireAuth },
    async (req, reply) => {
      const season = seasonParam(req.query.season);
      if (season === null) return reply.code(404).send({ error: t.api.unknownSeason });
      const current = season === currentSeason();
      // A past season is viewed as a whole, not week by week.
      const week = req.query.week && current ? Number(req.query.week) : undefined;
      return {
        season,
        seasons: knownSeasons(),
        week: week ?? null,
        startWeek: startWeek(season),
        rows: standings(week, season),
        // During the season, while games are on: "if it ends like this" projection.
        live: week || !current ? null : liveProjection()
      };
    }
  );

  app.get<{ Querystring: { week?: string }; Reply: Replies<RecapDto> }>('/api/recap', { preHandler: requireAuth }, async (req, reply) => {
    const week = req.query.week ? Number(req.query.week) : latestRecapWeek();
    if (!week) return reply.code(404).send({ error: t.api.noFinishedGame });
    return recap(week);
  });

  app.get<{ Reply: Replies<ProfileDto> }>('/api/profile', { preHandler: requireAuth }, async (req) => {
    const rows = standings();
    const me = rows.find((r) => r.id === req.me.id)!;
    return {
      ...req.me,
      season: currentSeason(),
      startWeek: startWeek(),
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

  app.get<{ Querystring: { season?: string }; Reply: Replies<SeasonDto> }>('/api/season', { preHandler: requireAuth }, async (req, reply) => {
    const season = seasonParam(req.query.season);
    if (season === null) return reply.code(404).send({ error: t.api.unknownSeason });
    const sb = db.prepare('SELECT status FROM games WHERE season = ? AND week = 22').get(season) as { status: string } | undefined;
    const games = db
      .prepare("SELECT COUNT(*) AS n FROM games WHERE season = ? AND week >= ? AND status = 'final'")
      .get(season, startWeek(season)) as { n: number };
    return {
      season,
      seasons: knownSeasons(),
      startWeek: startWeek(season),
      // A past season is over, even if games are missing from the database.
      finished: sb?.status === 'final' || season !== currentSeason(),
      finalGames: games.n,
      rows: standings(undefined, season),
      awards: awards(season)
    };
  });
}
