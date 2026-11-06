/** Classement de la bande, récap de la semaine, profil et bilan de saison. */
import type { FastifyInstance } from 'fastify';
import type { LeaderboardDto, ProfileDto, RecapDto, Replies, SeasonDto } from '../../shared/api';
import { currentSeason } from '../config';
import { db, knownSeasons, startWeek } from '../db';
import { awards, latestRecapWeek, liveProjection, recap, standings, streak, weeklyResults } from '../scoring';
import { requireAuth } from './guards';

/** ?season=2025 : une saison passée ; sans paramètre, la saison en cours. null si la saison est inconnue. */
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
      if (season === null) return reply.code(404).send({ error: 'Saison inconnue.' });
      const current = season === currentSeason();
      // Une saison passée se consulte en entier, pas semaine par semaine.
      const week = req.query.week && current ? Number(req.query.week) : undefined;
      return {
        season,
        seasons: knownSeasons(),
        week: week ?? null,
        startWeek: startWeek(season),
        rows: standings(week, season),
        // En saison, pendant les matchs : projection « si ça finit comme ça ».
        live: week || !current ? null : liveProjection()
      };
    }
  );

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
    if (season === null) return reply.code(404).send({ error: 'Saison inconnue.' });
    const sb = db.prepare('SELECT status FROM games WHERE season = ? AND week = 22').get(season) as { status: string } | undefined;
    const games = db
      .prepare("SELECT COUNT(*) AS n FROM games WHERE season = ? AND week >= ? AND status = 'final'")
      .get(season, startWeek(season)) as { n: number };
    return {
      season,
      seasons: knownSeasons(),
      startWeek: startWeek(season),
      // Une saison passée est terminée, même s'il manque des matchs en base.
      finished: sb?.status === 'final' || season !== currentSeason(),
      finalGames: games.n,
      rows: standings(undefined, season),
      awards: awards(season)
    };
  });
}
