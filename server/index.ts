import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { HOST, PORT, SEASON, START_WEEK, SYNC_ENABLED, WEB_DIR } from './config';
import './db';
import { routes } from './routes';
import { LOGO_DIR, syncTick } from './sync';
import { notificationsTick } from './push';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'warn' }, trustProxy: true });

await app.register(cookie);
await app.register(routes);

mkdirSync(LOGO_DIR, { recursive: true });
await app.register(fastifyStatic, {
  root: LOGO_DIR,
  prefix: '/logos/',
  decorateReply: false,
  maxAge: '30d'
});

if (existsSync(WEB_DIR)) {
  await app.register(fastifyStatic, {
    root: WEB_DIR,
    prefix: '/',
    setHeaders(res, filePath) {
      // Le service worker et la page doivent toujours être frais ; le reste est versionné par Vite.
      const name = path.basename(filePath);
      if (name === 'sw.js' || name === 'index.html' || name.endsWith('.webmanifest')) res.setHeader('cache-control', 'no-cache');
      else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    }
  });
  // Toute URL qui n'est ni l'API ni un fichier renvoie l'appli (routage côté téléphone).
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/logos/')) return reply.code(404).send({ error: 'Introuvable' });
    return reply.header('cache-control', 'no-cache').sendFile('index.html');
  });
} else {
  console.warn(`[web] ${WEB_DIR} absent : lance « npm run build » (ou utilise « npm run dev »).`);
}

await app.listen({ port: PORT, host: HOST });
console.log(`[prono] saison ${SEASON}, pronos comptés dès la semaine ${START_WEEK}, à l'écoute sur ${HOST}:${PORT}`);

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    if (SYNC_ENABLED) await syncTick();
  } catch (e) {
    console.error('[sync] erreur', (e as Error).message);
  }
  try {
    await notificationsTick();
  } catch (e) {
    console.error('[push] erreur', (e as Error).message);
  }
  running = false;
}
void tick();
setInterval(tick, 60_000);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    process.exit(0);
  });
}
