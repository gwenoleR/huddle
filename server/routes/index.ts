/** Toutes les routes de l'API, une par domaine. Les formes des réponses sont dans shared/api.ts. */
import type { FastifyInstance } from 'fastify';
import { adminRoutes } from './admin';
import { authRoutes } from './auth';
import { bonusRoutes } from './bonus';
import { gamesRoutes } from './games';
import { leaderboardRoutes } from './leaderboard';
import { nflRoutes } from './nfl';
import { pushRoutes } from './push';

export async function routes(app: FastifyInstance) {
  await app.register(authRoutes);
  await app.register(gamesRoutes);
  await app.register(nflRoutes);
  await app.register(leaderboardRoutes);
  await app.register(bonusRoutes);
  await app.register(adminRoutes);
  await app.register(pushRoutes);
}
