import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SEASON, START_WEEK, weekLabel } from './config';
import { db } from './db';
import {
  LOCK_MINUTES,
  MAX_ATTEMPTS,
  clientIp,
  createSession,
  currentPlayer,
  destroySession,
  hashPin,
  ipBlocked,
  isValidPin,
  recordIpFailure,
  verifyPin,
  type Me
} from './auth';
import { awards, latestRecapWeek, liveProjection, pointsFor, recap, standings, streak, weeklyResults } from './scoring';
import { deleteSubscription, saveSubscription, sendToPlayer, vapidPublicKey } from './push';
import { forceSync, syncStatus } from './sync';
import { fetchLive, fetchPreview, type LiveInfo, type Preview } from './espn';

// ---------- Mise en forme ----------

interface TeamRow {
  id: string;
  abbr: string;
  name: string;
  display_name: string;
  color: string | null;
  alt_color: string | null;
}

function readableOn(hex: string): string {
  const n = parseInt(hex, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 0.35 ? '#000000' : '#ffffff';
}

function teamDto(t: TeamRow) {
  const color = t.color ?? '333333';
  const abbr = t.abbr.toLowerCase();
  return {
    abbr: t.abbr,
    name: t.name,
    fullName: t.display_name,
    color: `#${color}`,
    textColor: readableOn(color),
    logo: `/logos/${abbr}.png`,
    logoDark: `/logos/${abbr}-dark.png`
  };
}

interface GameRow {
  id: string;
  week: number;
  kickoff: number;
  status: string;
  detail: string | null;
  away_id: string;
  home_id: string;
  away_score: number | null;
  home_score: number | null;
  winner: string | null;
}

const isLocked = (g: GameRow, now = Date.now()) => g.status !== 'scheduled' || g.kickoff <= now || g.week < START_WEEK;

function gamesDto(rows: GameRow[], me: Me) {
  if (!rows.length) return [];
  const teams = new Map((db.prepare('SELECT * FROM teams').all() as unknown as TeamRow[]).map((t) => [t.id, t]));
  const ids = rows.map((r) => r.id);
  const picks = db
    .prepare(
      `SELECT k.game_id, k.side, p.id AS player_id, p.name FROM picks k JOIN players p ON p.id = k.player_id
       WHERE k.game_id IN (${ids.map(() => '?').join(',')}) ORDER BY k.updated_at`
    )
    .all(...ids) as { game_id: string; side: 'away' | 'home'; player_id: number; name: string }[];

  return rows.map((g) => {
    const mine = picks.find((p) => p.game_id === g.id && p.player_id === me.id);
    const pickers = (side: string) => picks.filter((p) => p.game_id === g.id && p.side === side).map((p) => p.name);
    return {
      id: g.id,
      week: g.week,
      kickoff: g.kickoff,
      status: g.status,
      detail: g.detail,
      locked: isLocked(g),
      points: pointsFor(g.week),
      away: teamDto(teams.get(g.away_id)!),
      home: teamDto(teams.get(g.home_id)!),
      score: g.away_score != null && g.home_score != null ? { away: g.away_score, home: g.home_score } : null,
      winner: g.winner,
      myPick: mine?.side ?? null,
      pickers: { away: pickers('away'), home: pickers('home') }
    };
  });
}

// ---------- Routes ----------

declare module 'fastify' {
  interface FastifyRequest {
    me: Me;
  }
}

export async function routes(app: FastifyInstance) {
  const requireAuth = async (req: FastifyRequest, reply: FastifyReply) => {
    const me = currentPlayer(req);
    if (!me) return reply.code(401).send({ error: 'Connecte-toi d’abord' });
    req.me = me;
  };
  const requireAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;
    if (!req.me.isAdmin) return reply.code(403).send({ error: 'Réservé à l’admin' });
  };

  app.get('/api/health', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    return { ok: true, version: (process.env.APP_VERSION ?? 'dev').slice(0, 7) };
  });

  // --- Connexion ---

  app.get('/api/players', async () =>
    (db.prepare('SELECT id, name, pin_hash IS NOT NULL AS hasPin FROM players ORDER BY name COLLATE NOCASE').all() as any[]).map(
      (p) => ({ id: p.id, name: p.name, hasPin: !!p.hasPin })
    )
  );

  app.post<{ Body: { playerId?: number; pin?: string } }>('/api/login', async (req, reply) => {
    const ip = clientIp(req);
    if (ipBlocked(ip)) return reply.code(429).send({ error: 'Trop d’essais depuis cette connexion, réessaie dans une heure.' });

    const { playerId, pin } = req.body ?? {};
    if (!isValidPin(pin)) return reply.code(400).send({ error: 'Le code fait 4 chiffres.' });
    const p = db.prepare('SELECT * FROM players WHERE id = ?').get(Number(playerId)) as any;
    if (!p) return reply.code(404).send({ error: 'Joueur inconnu.' });

    const now = Date.now();
    if (p.locked_until > now) {
      const min = Math.ceil((p.locked_until - now) / 60_000);
      return reply.code(429).send({ error: `Trop d’essais. Réessaie dans ${min} min.`, retryInMinutes: min });
    }

    // Première connexion : le code tapé devient celui du joueur.
    if (!p.pin_hash) {
      db.prepare('UPDATE players SET pin_hash = ?, failed_attempts = 0 WHERE id = ?').run(hashPin(pin), p.id);
      createSession(reply, p.id);
      return { ok: true, created: true };
    }

    if (!verifyPin(pin, p.pin_hash)) {
      recordIpFailure(ip);
      const attempts = p.failed_attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        db.prepare('UPDATE players SET failed_attempts = 0, locked_until = ? WHERE id = ?').run(now + LOCK_MINUTES * 60_000, p.id);
        return reply.code(429).send({ error: `Trop d’essais. Réessaie dans ${LOCK_MINUTES} min.`, retryInMinutes: LOCK_MINUTES });
      }
      db.prepare('UPDATE players SET failed_attempts = ? WHERE id = ?').run(attempts, p.id);
      const left = MAX_ATTEMPTS - attempts;
      return reply.code(401).send({ error: `Code incorrect. Encore ${left} essai${left > 1 ? 's' : ''}.`, attemptsLeft: left });
    }

    db.prepare('UPDATE players SET failed_attempts = 0, locked_until = 0 WHERE id = ?').run(p.id);
    createSession(reply, p.id);
    return { ok: true };
  });

  app.post('/api/logout', async (req, reply) => {
    destroySession(req, reply);
    return { ok: true };
  });

  app.get('/api/me', { preHandler: requireAuth }, async (req) => req.me);

  // --- Matchs ---

  app.get('/api/weeks', { preHandler: requireAuth }, async () => {
    const rows = db
      .prepare(
        `SELECT week, COUNT(*) AS games, SUM(status = 'final') AS finals, MIN(kickoff) AS first
         FROM games WHERE season = ? GROUP BY week ORDER BY week`
      )
      .all(SEASON) as { week: number; games: number; finals: number; first: number }[];
    // Semaine en cours : la première qui a encore un match non terminé.
    const current = rows.find((r) => r.finals < r.games)?.week ?? rows.at(-1)?.week ?? START_WEEK;
    return {
      season: SEASON,
      startWeek: START_WEEK,
      current,
      weeks: rows.map((r) => ({ week: r.week, label: weekLabel(r.week), longLabel: weekLabel(r.week, true), points: pointsFor(r.week) }))
    };
  });

  app.get<{ Params: { week: string } }>('/api/weeks/:week', { preHandler: requireAuth }, async (req) => {
    const week = Number(req.params.week);
    const rows = db.prepare('SELECT * FROM games WHERE season = ? AND week = ? ORDER BY kickoff, id').all(SEASON, week) as unknown as GameRow[];
    return { week, label: weekLabel(week, true), points: pointsFor(week), games: gamesDto(rows, req.me) };
  });

  app.get<{ Params: { id: string } }>('/api/games/:id', { preHandler: requireAuth }, async (req, reply) => {
    const row = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as unknown as GameRow | undefined;
    if (!row) return reply.code(404).send({ error: 'Match introuvable.' });
    const [game] = gamesDto([row], req.me);
    const done = new Set([...game.pickers.away, ...game.pickers.home]);
    const waiting = (db.prepare('SELECT name FROM players ORDER BY name COLLATE NOCASE').all() as { name: string }[])
      .map((p) => p.name)
      .filter((n) => !done.has(n));
    return { ...game, weekLabel: weekLabel(row.week, true), waiting, counted: row.week >= START_WEEK };
  });

  // Avant-match : bilan, forme, favori et blessés, pris chez ESPN à la demande et gardés 20 min en mémoire.
  const previews = new Map<string, { at: number; data: Preview }>();
  app.get<{ Params: { id: string } }>('/api/games/:id/preview', { preHandler: requireAuth }, async (req, reply) => {
    const row = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id) as { id: string } | undefined;
    if (!row) return reply.code(404).send({ error: 'Match introuvable.' });
    const hit = previews.get(row.id);
    if (hit && Date.now() - hit.at < 20 * 60_000) return hit.data;
    try {
      const data = await fetchPreview(row.id);
      if (previews.size > 200) previews.clear();
      previews.set(row.id, { at: Date.now(), data });
      return data;
    } catch (e) {
      req.log.warn({ err: e }, 'avant-match indisponible');
      if (hit) return hit.data;
      return reply.code(502).send({ error: 'Infos d’avant-match indisponibles pour le moment.' });
    }
  });

  // Pendant le match : courbe des chances, actions qui marquent et situation en cours.
  // 25 s de cache pendant le match (tous les joueurs regardent en même temps), 6 h une fois terminé.
  const lives = new Map<string, { at: number; ttl: number; data: LiveInfo }>();
  app.get<{ Params: { id: string } }>('/api/games/:id/live', { preHandler: requireAuth }, async (req, reply) => {
    const row = db.prepare('SELECT id, week, status FROM games WHERE id = ?').get(req.params.id) as
      | { id: string; week: number; status: string }
      | undefined;
    if (!row) return reply.code(404).send({ error: 'Match introuvable.' });
    if (row.status !== 'live' && row.status !== 'final') return reply.code(409).send({ error: 'Le match n’a pas commencé.' });
    const hit = lives.get(row.id);
    if (hit && Date.now() - hit.at < hit.ttl) return hit.data;
    try {
      const data = await fetchLive(row.id, row.week >= 19);
      if (lives.size > 200) lives.clear();
      lives.set(row.id, { at: Date.now(), ttl: row.status === 'final' ? 6 * 3600_000 : 25_000, data });
      return data;
    } catch (e) {
      req.log.warn({ err: e }, 'direct indisponible');
      if (hit) return hit.data;
      return reply.code(502).send({ error: 'Le direct ESPN ne répond pas pour le moment.' });
    }
  });

  app.put<{ Params: { id: string }; Body: { side?: string } }>('/api/picks/:id', { preHandler: requireAuth }, async (req, reply) => {
    const side = req.body?.side;
    if (side !== 'away' && side !== 'home') return reply.code(400).send({ error: 'Choix invalide.' });
    const g = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as unknown as GameRow | undefined;
    if (!g) return reply.code(404).send({ error: 'Match introuvable.' });
    if (isLocked(g)) return reply.code(409).send({ error: 'Trop tard, le match a commencé.' });
    db.prepare(
      `INSERT INTO picks (player_id, game_id, side, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(player_id, game_id) DO UPDATE SET side = excluded.side, updated_at = excluded.updated_at`
    ).run(req.me.id, g.id, side, Date.now());
    return { ok: true };
  });

  // --- Classement, profil, bilan ---

  app.get<{ Querystring: { week?: string } }>('/api/leaderboard', { preHandler: requireAuth }, async (req) => {
    const week = req.query.week ? Number(req.query.week) : undefined;
    // En saison, pendant les matchs : projection « si ça finit comme ça ».
    return { week: week ?? null, startWeek: START_WEEK, rows: standings(week), live: week ? null : liveProjection() };
  });

  app.get<{ Querystring: { week?: string } }>('/api/recap', { preHandler: requireAuth }, async (req, reply) => {
    const week = req.query.week ? Number(req.query.week) : latestRecapWeek();
    if (!week) return reply.code(404).send({ error: 'Pas encore de match terminé depuis la reprise.' });
    return recap(week);
  });

  app.get('/api/profile', { preHandler: requireAuth }, async (req) => {
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

  app.get('/api/season', { preHandler: requireAuth }, async () => {
    const sb = db.prepare("SELECT status FROM games WHERE season = ? AND week = 22").get(SEASON) as { status: string } | undefined;
    const games = db.prepare("SELECT COUNT(*) AS n FROM games WHERE season = ? AND week >= ? AND status = 'final'").get(SEASON, START_WEEK) as {
      n: number;
    };
    return { season: SEASON, startWeek: START_WEEK, finished: sb?.status === 'final', finalGames: games.n, rows: standings(), awards: awards() };
  });

  // --- Admin ---

  app.get('/api/admin/players', { preHandler: requireAdmin }, async () =>
    (db.prepare('SELECT id, name, start_points AS startPoints, is_admin AS isAdmin, pin_hash IS NOT NULL AS hasPin FROM players ORDER BY name').all() as any[]).map(
      (p) => ({ ...p, isAdmin: !!p.isAdmin, hasPin: !!p.hasPin })
    )
  );

  app.post<{ Body: { name?: string; startPoints?: number } }>('/api/admin/players', { preHandler: requireAdmin }, async (req, reply) => {
    const name = String(req.body?.name ?? '').trim();
    const startPoints = Math.max(0, Math.round(Number(req.body?.startPoints ?? 0)));
    if (!name || name.length > 30) return reply.code(400).send({ error: 'Prénom invalide.' });
    try {
      db.prepare('INSERT INTO players (name, start_points, created_at) VALUES (?, ?, ?)').run(name, startPoints, Date.now());
    } catch {
      return reply.code(409).send({ error: 'Ce prénom existe déjà.' });
    }
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/admin/players/:id/reset-pin', { preHandler: requireAdmin }, async (req) => {
    const id = Number(req.params.id);
    db.prepare('UPDATE players SET pin_hash = NULL, failed_attempts = 0, locked_until = 0 WHERE id = ?').run(id);
    db.prepare('DELETE FROM sessions WHERE player_id = ?').run(id);
    return { ok: true };
  });

  app.get('/api/admin/sync', { preHandler: requireAdmin }, async () => syncStatus());

  app.post('/api/admin/sync', { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      await forceSync();
      return syncStatus();
    } catch {
      return reply.code(502).send({ error: `Synchro impossible : ${syncStatus().message}`, ...syncStatus() });
    }
  });

  // --- Notifications ---

  app.get('/api/push/public-key', async () => ({ key: vapidPublicKey }));

  app.post<{ Body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } }>(
    '/api/push/subscribe',
    { preHandler: requireAuth },
    async (req, reply) => {
      const s = req.body;
      if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth) return reply.code(400).send({ error: 'Abonnement invalide.' });
      saveSubscription(req.me.id, { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
      return { ok: true };
    }
  );

  app.post<{ Body: { endpoint?: string } }>('/api/push/unsubscribe', { preHandler: requireAuth }, async (req) => {
    if (req.body?.endpoint) deleteSubscription(req.body.endpoint);
    return { ok: true };
  });

  app.post('/api/push/test', { preHandler: requireAuth }, async (req) => {
    const sent = await sendToPlayer(req.me.id, {
      title: 'Ça marche !',
      body: `Salut ${req.me.name}, les notifications sont activées.`,
      url: '/#/profil',
      tag: 'test'
    });
    return { sent };
  });
}
