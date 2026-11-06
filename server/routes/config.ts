/** Réglages publics de l'instance : nom, langue, barème. Et le manifeste de l'appli installable, qui en dépend. */
import type { FastifyInstance } from 'fastify';
import type { ConfigDto } from '../../shared/api';
import { APP_LANG, APP_NAME, APP_SHORT_NAME, POINTS_PLAYOFFS, POINTS_REGULAR, t } from '../config';

export const publicConfig = (): ConfigDto => ({
  appName: APP_NAME,
  appShortName: APP_SHORT_NAME,
  lang: APP_LANG,
  points: { regular: POINTS_REGULAR, playoffs: POINTS_PLAYOFFS }
});

/** Manifeste de la PWA : généré ici (et pas au build) pour porter le nom et la langue de l'instance. */
export function webManifest() {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: t.common.appDescription,
    lang: t.common.htmlLang,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d131d',
    theme_color: '#0d131d',
    icons: [
      { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}

export async function configRoutes(app: FastifyInstance) {
  app.get<{ Reply: ConfigDto }>('/api/config', async () => publicConfig());

  app.get('/manifest.webmanifest', async (_req, reply) => {
    reply.header('content-type', 'application/manifest+json').header('cache-control', 'no-cache');
    return webManifest();
  });
}
