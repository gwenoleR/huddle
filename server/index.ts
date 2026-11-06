import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { HOST, PORT, PUBLIC_URL, SYNC_ENABLED, WEB_DIR, currentSeason, t } from './config';
import { db, startWeek } from './db';
import { routes } from './routes';
import { LOGO_DIR, syncTick } from './sync';
import { notificationsTick } from './push';
import { bonusTick } from './bonus';
import { resetIfNewVersion } from './espnCache';

// New app version: the ESPN cache starts from scratch (the data format may have changed).
resetIfNewVersion();

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
      // The service worker and the page must always be fresh; everything else is versioned by Vite.
      const name = path.basename(filePath);
      if (name === 'sw.js' || name === 'index.html' || name.endsWith('.webmanifest')) res.setHeader('cache-control', 'no-cache');
      else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    }
  });
  // Any URL that is neither the API nor a file serves the app (client-side routing).
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/logos/')) return reply.code(404).send({ error: t.api.notFound });
    return reply.header('cache-control', 'no-cache').sendFile('index.html');
  });
} else {
  console.warn(`[web] ${WEB_DIR} missing: run "npm run build" (or use "npm run dev").`);
}

await app.listen({ port: PORT, host: HOST });
console.log(`[prono] season ${currentSeason()}, picks counted from week ${startWeek()}, listening on ${HOST}:${PORT}`);
if (!(db.prepare('SELECT 1 FROM players LIMIT 1').get())) console.log(`[prono] no players: open ${PUBLIC_URL} to create your group (you will be its admin)`);

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    if (SYNC_ENABLED) await syncTick();
  } catch (e) {
    console.error('[sync] error', (e as Error).message);
  }
  try {
    await bonusTick();
  } catch (e) {
    console.error('[bonus] error', (e as Error).message);
  }
  try {
    await notificationsTick();
  } catch (e) {
    console.error('[push] error', (e as Error).message);
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
