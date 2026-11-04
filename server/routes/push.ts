/** Abonnement aux notifications. */
import type { FastifyInstance } from 'fastify';
import type { OkDto, Replies } from '../../shared/api';
import { deleteSubscription, saveSubscription, sendToPlayer, vapidPublicKey } from '../push';
import { requireAuth } from './guards';

export async function pushRoutes(app: FastifyInstance) {
  app.get<{ Reply: { key: string } }>('/api/push/public-key', async () => ({ key: vapidPublicKey() }));

  app.post<{ Body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; Reply: Replies<OkDto> }>(
    '/api/push/subscribe',
    { preHandler: requireAuth },
    async (req, reply) => {
      const s = req.body;
      if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth) return reply.code(400).send({ error: 'Abonnement invalide.' });
      saveSubscription(req.me.id, { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
      return { ok: true };
    }
  );

  app.post<{ Body: { endpoint?: string }; Reply: Replies<OkDto> }>('/api/push/unsubscribe', { preHandler: requireAuth }, async (req) => {
    if (req.body?.endpoint) deleteSubscription(req.body.endpoint);
    return { ok: true };
  });

  app.post<{ Reply: Replies<{ sent: number }> }>('/api/push/test', { preHandler: requireAuth }, async (req) => {
    const sent = await sendToPlayer(req.me.id, {
      title: 'Ça marche !',
      body: `Salut ${req.me.name}, les notifications sont activées.`,
      url: '/#/profil',
      tag: 'test'
    });
    return { sent };
  });
}
