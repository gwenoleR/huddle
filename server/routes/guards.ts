import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentPlayer, type Me } from '../auth';
import { t } from '../config';

declare module 'fastify' {
  interface FastifyRequest {
    me: Me;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const me = currentPlayer(req);
  if (!me) return reply.code(401).send({ error: t.api.loginFirst });
  req.me = me;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (!req.me.isAdmin) return reply.code(403).send({ error: t.api.adminOnly });
}
