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
import {
  bonusField,
  bonusLockAt,
  bonusPhase,
  bonusPicks,
  bonusPointsByPlayer,
  bonusResult,
  bonusRevealAt,
  bonusRevealed,
  bonusSettings,
  saveBonusPick,
  saveBonusSettings
} from './bonus';
import { espnStats, fetchLive, fetchPreview, fetchStandings, type NflStandings } from './espn';
import { FOREVER, cached } from './espnCache';

const MIN = 60_000;
const HOUR = 60 * MIN;

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

  // Classement NFL : il ne bouge qu'à la fin des matchs. Frais 30 min, puis resservi le temps d'être rafraîchi.
  const nflStandings = () => cached(`standings:${SEASON}`, () => fetchStandings(SEASON), { ttl: 30 * MIN, swr: 24 * HOUR });
  /** Place d'une équipe : « 1er AFC Est », tête de série dans sa conférence. */
  function standingOf(s: NflStandings, teamId: string) {
    for (const c of s.conferences)
      for (const d of c.divisions) {
        const t = d.teams.find((x) => x.teamId === teamId);
        if (t) return { conference: c.abbr, division: d.name, divRank: t.divRank, seed: t.seed, clinch: t.clinch };
      }
    return null;
  }

  app.get('/api/nfl/standings', { preHandler: requireAuth }, async (req, reply) => {
    let s: NflStandings;
    try {
      s = await nflStandings();
    } catch (e) {
      req.log.warn({ err: e }, 'classement NFL indisponible');
      return reply.code(502).send({ error: 'Le classement NFL ne répond pas pour le moment.' });
    }
    const teams = new Map((db.prepare('SELECT * FROM teams').all() as unknown as TeamRow[]).map((t) => [t.id, t]));
    const row = (t: NflStandings['conferences'][number]['divisions'][number]['teams'][number]) => {
      const tr = teams.get(t.teamId);
      return tr ? { ...t, team: teamDto(tr) } : null;
    };
    return {
      season: SEASON,
      conferences: s.conferences.map((c) => {
        const divisions = c.divisions.map((d) => ({ name: d.name, teams: d.teams.map(row).filter(Boolean) }));
        const seeds = divisions
          .flatMap((d) => d.teams.map((t) => ({ ...t!, division: d.name })))
          .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
        return { abbr: c.abbr, divisions, seeds };
      })
    };
  });

  // --- Bonus de fin de saison ---

  app.get('/api/bonus', { preHandler: requireAuth }, async (req) => {
    const settings = bonusSettings();
    const phase = bonusPhase();
    const field = bonusField();
    const teams = new Map((db.prepare('SELECT * FROM teams').all() as unknown as TeamRow[]).map((t) => [t.id, t]));
    const team = (id: string | null) => (id && teams.has(id) ? teamDto(teams.get(id)!) : null);
    const picks = bonusPicks();
    const mine = picks.find((p) => p.playerId === req.me.id) ?? null;
    const result = bonusResult();
    const points = bonusPointsByPlayer();
    const revealed = bonusRevealed();
    const players = db.prepare('SELECT id, name FROM players ORDER BY name COLLATE NOCASE').all() as { id: number; name: string }[];
    const pickDto = (p: (typeof picks)[number]) => ({ afc: team(p.afc), nfc: team(p.nfc), sb: team(p.sb), sbTotal: p.sbTotal });
    return {
      enabled: settings.enabled,
      points: settings.points,
      reveal: settings.reveal,
      phase,
      lockAt: bonusLockAt(),
      revealed,
      revealAt: bonusRevealAt(),
      field: field
        ? {
            afc: field.afc.map((t) => ({ seed: t.seed, team: team(t.teamId) })),
            nfc: field.nfc.map((t) => ({ seed: t.seed, team: team(t.teamId) }))
          }
        : null,
      mine: mine ? pickDto(mine) : null,
      // Avant la révélation : seulement qui a choisi (pas quoi). Après : les choix de tout le monde.
      players: players.map((pl) => {
        const p = picks.find((x) => x.playerId === pl.id);
        return {
          name: pl.name,
          done: !!p,
          pick: revealed && p ? pickDto(p) : null,
          points: revealed && p ? points.get(pl.id) ?? 0 : null
        };
      }),
      result: { afc: team(result.afc), nfc: team(result.nfc), sb: team(result.sb), sbTotal: result.sbTotal }
    };
  });

  app.put<{ Body: { afc?: string; nfc?: string; sb?: string; sbTotal?: number } }>('/api/bonus', { preHandler: requireAuth }, async (req, reply) => {
    if (bonusPhase() !== 'open') return reply.code(409).send({ error: 'Les choix du bonus ne sont pas ouverts.' });
    const field = bonusField()!;
    const byAbbr = (abbr: unknown) =>
      typeof abbr === 'string' ? (db.prepare('SELECT id FROM teams WHERE abbr = ? COLLATE NOCASE').get(abbr) as { id: string } | undefined)?.id : undefined;
    const afc = byAbbr(req.body?.afc);
    const nfc = byAbbr(req.body?.nfc);
    const sb = byAbbr(req.body?.sb);
    const total = Number(req.body?.sbTotal);
    if (!afc || !field.afc.some((t) => t.teamId === afc)) return reply.code(400).send({ error: 'Choisis un champion AFC parmi les qualifiés.' });
    if (!nfc || !field.nfc.some((t) => t.teamId === nfc)) return reply.code(400).send({ error: 'Choisis un champion NFC parmi les qualifiés.' });
    if (!sb || (sb !== afc && sb !== nfc)) return reply.code(400).send({ error: 'Le vainqueur du Super Bowl doit être un de tes deux champions.' });
    if (!Number.isInteger(total) || total < 0 || total > 200) return reply.code(400).send({ error: 'Donne un total de points entre 0 et 200.' });
    saveBonusPick({ playerId: req.me.id, afc, nfc, sb, sbTotal: total });
    return { ok: true };
  });

  app.get('/api/admin/bonus', { preHandler: requireAdmin }, async () => bonusSettings());

  app.put<{ Body: { enabled?: boolean; reveal?: string; points?: { afc?: number; nfc?: number; sb?: number } } }>(
    '/api/admin/bonus',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const cur = bonusSettings();
      const pts = { ...cur.points, ...(req.body?.points ?? {}) };
      for (const v of Object.values(pts))
        if (!Number.isInteger(v) || v < 0 || v > 50) return reply.code(400).send({ error: 'Les points doivent être des nombres entiers entre 0 et 50.' });
      const reveal = req.body?.reveal ?? cur.reveal;
      if (reveal !== 'wildcard' && reveal !== 'superbowl') return reply.code(400).send({ error: 'Révélation inconnue.' });
      const next = { enabled: req.body?.enabled ?? cur.enabled, points: pts, reveal: reveal as 'wildcard' | 'superbowl' };
      saveBonusSettings(next);
      return next;
    }
  );

  // Fiche équipe : place au classement, calendrier de la saison et ce que la bande a fait avec elle.
  app.get<{ Params: { abbr: string } }>('/api/teams/:abbr', { preHandler: requireAuth }, async (req, reply) => {
    const t = db.prepare('SELECT * FROM teams WHERE abbr = ? COLLATE NOCASE').get(req.params.abbr) as unknown as TeamRow | undefined;
    if (!t) return reply.code(404).send({ error: 'Équipe introuvable.' });
    const teams = new Map((db.prepare('SELECT * FROM teams').all() as unknown as TeamRow[]).map((x) => [x.id, x]));

    const games = db
      .prepare('SELECT * FROM games WHERE season = ? AND (away_id = ? OR home_id = ?) ORDER BY kickoff')
      .all(SEASON, t.id, t.id) as unknown as GameRow[];
    const schedule = games.map((g) => {
      const home = g.home_id === t.id;
      const opp = teams.get(home ? g.away_id : g.home_id)!;
      const us = home ? g.home_score : g.away_score;
      const them = home ? g.away_score : g.home_score;
      const result =
        g.status !== 'final' ? null : g.winner === 'tie' ? 'N' : g.winner === (home ? 'home' : 'away') ? 'V' : 'D';
      return {
        id: g.id,
        week: g.week,
        weekLabel: weekLabel(g.week),
        kickoff: g.kickoff,
        status: g.status,
        detail: g.detail,
        home,
        opponent: teamDto(opp),
        score: us != null && them != null ? `${us}-${them}` : null,
        result
      };
    });

    // Pronos de la bande sur les matchs terminés de cette équipe, depuis la reprise.
    const rows = db
      .prepare(
        `SELECT p.id, p.name, k.side, g.winner, CASE WHEN g.home_id = ? THEN 'home' ELSE 'away' END AS teamSide
         FROM picks k JOIN players p ON p.id = k.player_id JOIN games g ON g.id = k.game_id
         WHERE g.season = ? AND g.week >= ? AND g.status = 'final' AND (g.away_id = ? OR g.home_id = ?)`
      )
      .all(t.id, SEASON, START_WEEK, t.id, t.id) as { id: number; name: string; side: string; winner: string | null; teamSide: string }[];
    const players = db.prepare('SELECT id, name FROM players ORDER BY name COLLATE NOCASE').all() as { id: number; name: string }[];
    const bande = players
      .map((p) => {
        const mine = rows.filter((r) => r.id === p.id);
        const withTeam = mine.filter((r) => r.side === r.teamSide);
        const against = mine.filter((r) => r.side !== r.teamSide);
        return {
          name: p.name,
          with: withTeam.length,
          withGood: withTeam.filter((r) => r.winner === r.side).length,
          against: against.length,
          againstGood: against.filter((r) => r.winner === r.side).length
        };
      })
      .sort((a, b) => b.with + b.against - (a.with + a.against) || a.name.localeCompare(b.name));

    const s = await nflStandings().catch(() => null);
    const finals = schedule.filter((g) => g.result);
    const count = (r: string) => finals.filter((g) => g.result === r).length;
    const ties = count('N');
    return {
      team: teamDto(t),
      record: `${count('V')}-${count('D')}${ties ? `-${ties}` : ''}`,
      standing: s ? standingOf(s, t.id) : null,
      schedule,
      bande
    };
  });

  // Avant-match : bilan, forme, favori et blessés. Frais 20 min ; ensuite on sert l'ancienne version
  // tout de suite et on rafraîchit en arrière-plan.
  app.get<{ Params: { id: string } }>('/api/games/:id/preview', { preHandler: requireAuth }, async (req, reply) => {
    const game = db.prepare('SELECT id, away_id, home_id FROM games WHERE id = ?').get(req.params.id) as
      | { id: string; away_id: string; home_id: string }
      | undefined;
    if (!game) return reply.code(404).send({ error: 'Match introuvable.' });
    let data;
    try {
      data = await cached(`preview:${game.id}`, () => fetchPreview(game.id), { ttl: 20 * MIN, swr: 6 * HOUR });
    } catch (e) {
      req.log.warn({ err: e }, 'avant-match indisponible');
      return reply.code(502).send({ error: 'Infos d’avant-match indisponibles pour le moment.' });
    }
    // La place au classement est un bonus : si ESPN ne répond pas, l'avant-match s'affiche sans.
    const s = await nflStandings().catch(() => null);
    return { ...data, standing: s ? { away: standingOf(s, game.away_id), home: standingOf(s, game.home_id) } : null };
  });

  // Pendant le match : courbe des chances, actions qui marquent et situation en cours.
  // 25 s pendant le match (tout le monde regarde en même temps) ; 1 h une fois terminé, le temps
  // qu'ESPN corrige ses stats ; puis plus jamais redemandé passé le lendemain.
  app.get<{ Params: { id: string } }>('/api/games/:id/live', { preHandler: requireAuth }, async (req, reply) => {
    const row = db.prepare('SELECT id, week, status, kickoff FROM games WHERE id = ?').get(req.params.id) as
      | { id: string; week: number; status: string; kickoff: number }
      | undefined;
    if (!row) return reply.code(404).send({ error: 'Match introuvable.' });
    if (row.status !== 'live' && row.status !== 'final') return reply.code(409).send({ error: 'Le match n’a pas commencé.' });
    const final = row.status === 'final';
    const settled = final && row.kickoff < Date.now() - 24 * HOUR;
    try {
      return await cached(`live:${row.id}:${row.status}`, () => fetchLive(row.id, row.week >= 19), {
        ttl: settled ? FOREVER : final ? HOUR : 25_000,
        swr: final ? 24 * HOUR : MIN
      });
    } catch (e) {
      req.log.warn({ err: e }, 'direct indisponible');
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

  app.get('/api/admin/sync', { preHandler: requireAdmin }, async () => ({ ...syncStatus(), espn: espnStats() }));

  app.post('/api/admin/sync', { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      await forceSync();
      return { ...syncStatus(), espn: espnStats() };
    } catch {
      return reply.code(502).send({ error: `Synchro impossible : ${syncStatus().message}`, ...syncStatus(), espn: espnStats() });
    }
  });

  // --- Notifications ---

  app.get('/api/push/public-key', async () => ({ key: vapidPublicKey() }));

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
