import type { AwardDto, LeaderboardDto, LiveRow, ProfileDto, RecapDto, StandingRow } from '../shared/api';
import { SEASON, START_WEEK, weekLabel } from './config';
import { db } from './db';
import { bonusPicks, bonusPointsByPlayer, bonusResult, bonusSettings, tiebreakDistances } from './bonus';

export type { LiveRow, StandingRow };
export type WeekResult = ProfileDto['weeks'][number];
export type Award = AwardDto;
export type LiveProjection = NonNullable<LeaderboardDto['live']>;
export type Recap = RecapDto;

/** Barème : 1 point par bon prono en saison régulière, 2 points en playoffs (semaines 19 à 22). */
export const FIRST_PLAYOFF_WEEK = 19;
export const REGULAR_POINTS = 1;
export const PLAYOFF_POINTS = 2;
export const pointsFor = (week: number) => (week >= FIRST_PLAYOFF_WEEK ? PLAYOFF_POINTS : REGULAR_POINTS);
/** La même règle, pour les requêtes SQL (g = la table games). */
const POINTS_SQL = `(CASE WHEN g.week >= ${FIRST_PLAYOFF_WEEK} THEN ${PLAYOFF_POINTS} ELSE ${REGULAR_POINTS} END)`;

/** Classement : points des bons pronos (depuis la première semaine comptée), + points de départ éventuels (saison). */
export function standings(week?: number): StandingRow[] {
  const weekFilter = week ? 'AND g.week = ?' : '';
  const params: number[] = [SEASON, START_WEEK, ...(week ? [week] : [])];
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.start_points AS startPoints,
         COALESCE(SUM(CASE WHEN g.status = 'final' AND k.side = g.winner THEN 1 ELSE 0 END), 0) AS good,
         COALESCE(SUM(CASE WHEN g.status = 'final' AND k.side = g.winner THEN ${POINTS_SQL} ELSE 0 END), 0) AS earned,
         COALESCE(SUM(CASE WHEN g.status = 'final' THEN 1 ELSE 0 END), 0) AS played
       FROM players p
       LEFT JOIN picks k ON k.player_id = p.id
       LEFT JOIN games g ON g.id = k.game_id AND g.season = ? AND g.week >= ? ${weekFilter}
       GROUP BY p.id`
    )
    .all(...params) as (Omit<StandingRow, 'rank' | 'points'> & { earned: number })[];

  // Classement de la saison : on ajoute le bonus de fin de saison ; une fois le Super Bowl joué,
  // l'écart au total de points annoncé départage les égalités (le plus proche passe devant).
  const bonus = week ? new Map<number, number>() : bonusPointsByPlayer();
  const tie = week ? null : tiebreakDistances();
  const withPoints = rows.map(({ earned, ...r }) => {
    const b = bonus.get(r.id) ?? 0;
    return { ...r, bonus: b, points: (week ? 0 : r.startPoints) + earned + b, tie: tie ? tie.get(r.id) ?? Infinity : 0 };
  });
  withPoints.sort((a, b) => b.points - a.points || a.tie - b.tie || a.name.localeCompare(b.name, 'fr'));
  // Rangs à égalité : 1, 2, 2, 4
  const same = (x: (typeof withPoints)[number], y: (typeof withPoints)[number]) => x.points === y.points && x.tie === y.tie;
  const ranked: StandingRow[] = [];
  withPoints.forEach(({ tie: _tie, ...r }, i) => {
    const rank = i > 0 && same(withPoints[i - 1], withPoints[i]) ? ranked[i - 1].rank : i + 1;
    ranked.push({ ...r, rank });
  });
  return ranked;
}

export function weeklyResults(playerId: number): WeekResult[] {
  return (
    db
      .prepare(
        `SELECT g.week,
           SUM(CASE WHEN k.side = g.winner THEN 1 ELSE 0 END) AS good,
           COUNT(*) AS finals
         FROM games g
         LEFT JOIN picks k ON k.game_id = g.id AND k.player_id = ?
         WHERE g.season = ? AND g.week >= ? AND g.status = 'final'
         GROUP BY g.week ORDER BY g.week DESC`
      )
      .all(playerId, SEASON, START_WEEK) as { week: number; good: number; finals: number }[]
  ).map((r) => ({ ...r, good: r.good ?? 0, label: weekLabel(r.week) }));
}

/** Nombre de bons pronos d'affilée, du plus récent match terminé vers le passé. */
export function streak(playerId: number): number {
  const rows = db
    .prepare(
      `SELECT k.side = g.winner AS ok FROM picks k JOIN games g ON g.id = k.game_id
       WHERE k.player_id = ? AND g.season = ? AND g.week >= ? AND g.status = 'final'
       ORDER BY g.kickoff DESC`
    )
    .all(playerId, SEASON, START_WEEK) as { ok: number }[];
  let n = 0;
  for (const r of rows) {
    if (!r.ok) break;
    n++;
  }
  return n;
}

/** Les trophées de la saison, dans l'ordre d'affichage. Seuls les matchs terminés comptent. */
const TROPHIES: { id: string; title: string; rule: string }[] = [
  { id: 'best-week', title: 'Meilleure semaine', rule: 'Le plus grand nombre de bons pronos en une seule semaine. À égalité, la semaine avec le moins de matchs l’emporte (13 sur 13 bat 13 sur 16).' },
  { id: 'sniper', title: 'Le sniper', rule: 'Le meilleur taux de réussite de la saison. Il faut au moins 10 matchs joués pour être classé, histoire que 2 sur 2 ne suffise pas.' },
  { id: 'streak', title: 'Inarrêtable', rule: 'La plus longue série de bons pronos d’affilée, dans l’ordre des coups d’envoi. Il faut au moins 5 bons de suite. Un match sans prono ne casse pas la série.' },
  { id: 'contrarian', title: 'À contre-courant', rule: 'Le plus de pronos contre l’avis de la majorité de la bande, bons ou mauvais. Les matchs où la bande est partagée à égalité ne comptent pas.' },
  { id: 'heart', title: 'Le cœur avant la tête', rule: 'L’équipe choisie le plus souvent par un même joueur. Il faut l’avoir prise au moins 3 fois.' },
  { id: 'black-cat', title: 'Le chat noir', rule: 'L’équipe qui a fait perdre le plus de pronos à un même joueur : il l’a prise et elle a perdu. À partir de 3 trahisons.' },
  { id: 'last-minute', title: 'Sur le fil', rule: 'Le plus de pronos faits (ou changés) dans les 15 dernières minutes avant le coup d’envoi. À partir de 3.' },
  { id: 'nostradamus', title: 'Nostradamus', rule: 'Avoir annoncé le vainqueur du Super Bowl dans le bonus de fin de saison, avant même la Wild Card. Si plusieurs l’ont trouvé, le plus proche du total de points du Super Bowl l’emporte.' }
];

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Calcule chaque trophée : le gagnant et une ligne de détail, ou null si personne ne le mérite encore. */
function computeTrophy(id: string): { who: string; detail: string } | null {
  const args = [SEASON, START_WEEK] as const;
  switch (id) {
    case 'best-week': {
      const r = db
        .prepare(
          `SELECT p.name, g.week, SUM(CASE WHEN k.side = g.winner THEN 1 ELSE 0 END) AS good, COUNT(*) AS finals
           FROM players p JOIN games g ON g.season = ? AND g.week >= ? AND g.status = 'final'
           LEFT JOIN picks k ON k.game_id = g.id AND k.player_id = p.id
           GROUP BY p.id, g.week ORDER BY good DESC, finals ASC LIMIT 1`
        )
        .get(...args) as { name: string; week: number; good: number; finals: number } | undefined;
      return r && r.good > 0 ? { who: r.name, detail: `${r.good} sur ${r.finals} en ${weekLabel(r.week, true).toLowerCase()}` } : null;
    }
    case 'sniper': {
      const r = db
        .prepare(
          `SELECT p.name, SUM(k.side = g.winner) AS good, COUNT(*) AS played
           FROM picks k JOIN games g ON g.id = k.game_id JOIN players p ON p.id = k.player_id
           WHERE g.season = ? AND g.week >= ? AND g.status = 'final'
           GROUP BY p.id HAVING played >= 10 ORDER BY good * 1.0 / played DESC, played DESC LIMIT 1`
        )
        .get(...args) as { name: string; good: number; played: number } | undefined;
      return r ? { who: r.name, detail: `${Math.round((r.good * 100) / r.played)} % de réussite (${r.good} sur ${r.played})` } : null;
    }
    case 'streak': {
      const rows = db
        .prepare(
          `SELECT p.name, k.side = g.winner AS ok FROM picks k
           JOIN games g ON g.id = k.game_id JOIN players p ON p.id = k.player_id
           WHERE g.season = ? AND g.week >= ? AND g.status = 'final'
           ORDER BY p.id, g.kickoff, g.id`
        )
        .all(...args) as { name: string; ok: number }[];
      let best = { name: '', n: 0 };
      let cur = { name: '', n: 0 };
      for (const r of rows) {
        if (r.name !== cur.name) cur = { name: r.name, n: 0 };
        cur.n = r.ok ? cur.n + 1 : 0;
        if (cur.n > best.n) best = { ...cur };
      }
      return best.n >= 5 ? { who: best.name, detail: `${best.n} bons pronos d’affilée` } : null;
    }
    case 'contrarian': {
      const r = db
        .prepare(
          `WITH counts AS (
             SELECT k.game_id, SUM(k.side = 'away') AS a, SUM(k.side = 'home') AS h
             FROM picks k JOIN games g ON g.id = k.game_id
             WHERE g.season = ? AND g.week >= ? AND g.status = 'final' GROUP BY k.game_id
           )
           SELECT p.name, COUNT(*) AS n FROM picks k JOIN counts c ON c.game_id = k.game_id JOIN players p ON p.id = k.player_id
           WHERE (k.side = 'away' AND c.a < c.h) OR (k.side = 'home' AND c.h < c.a)
           GROUP BY p.id ORDER BY n DESC LIMIT 1`
        )
        .get(...args) as { name: string; n: number } | undefined;
      return r && r.n > 0 ? { who: r.name, detail: `${plural(r.n, 'prono')} contre la majorité` } : null;
    }
    case 'heart':
    case 'black-cat': {
      const lostOnly = id === 'black-cat' ? 'AND k.side != g.winner' : '';
      const r = db
        .prepare(
          `SELECT p.name, t.name AS team, COUNT(*) AS n FROM picks k
           JOIN games g ON g.id = k.game_id JOIN players p ON p.id = k.player_id
           JOIN teams t ON t.id = CASE k.side WHEN 'away' THEN g.away_id ELSE g.home_id END
           WHERE g.season = ? AND g.week >= ? AND g.status = 'final' ${lostOnly}
           GROUP BY p.id, t.id ORDER BY n DESC LIMIT 1`
        )
        .get(...args) as { name: string; team: string; n: number } | undefined;
      if (!r || r.n < 3) return null;
      return id === 'heart' ? { who: r.name, detail: `les ${r.team}, ${r.n} fois` } : { who: r.name, detail: `les ${r.team} l’ont trahi ${r.n} fois` };
    }
    case 'last-minute': {
      const r = db
        .prepare(
          `SELECT p.name, COUNT(*) AS n FROM picks k
           JOIN games g ON g.id = k.game_id JOIN players p ON p.id = k.player_id
           WHERE g.season = ? AND g.week >= ? AND g.kickoff <= ?
             AND k.updated_at <= g.kickoff AND k.updated_at > g.kickoff - 15 * 60000
           GROUP BY p.id ORDER BY n DESC LIMIT 1`
        )
        .get(...args, Date.now()) as { name: string; n: number } | undefined;
      return r && r.n >= 3 ? { who: r.name, detail: `${plural(r.n, 'prono')} dans le dernier quart d’heure` } : null;
    }
    case 'nostradamus': {
      const res = bonusResult();
      if (!res.sb || res.sbTotal == null) return null;
      const best = bonusPicks()
        .filter((p) => p.sb === res.sb)
        .sort((a, b) => Math.abs(a.sbTotal - res.sbTotal!) - Math.abs(b.sbTotal - res.sbTotal!))[0];
      if (!best) return null;
      const name = (db.prepare('SELECT name FROM players WHERE id = ?').get(best.playerId) as { name: string }).name;
      const team = (db.prepare('SELECT name FROM teams WHERE id = ?').get(res.sb) as { name: string } | undefined)?.name ?? '?';
      const gap = Math.abs(best.sbTotal - res.sbTotal);
      return { who: name, detail: `Les ${team} champions, annoncés avant la Wild Card · ${best.sbTotal} pts au total (${gap ? `écart ${gap}` : 'pile poil !'})` };
    }
  }
  return null;
}

/** Tous les trophées, attribués ou non (who = null), pour le bilan. */
export function awards(): Award[] {
  // Nostradamus n'existe que si le bonus de fin de saison est activé.
  const on = bonusSettings().enabled;
  return TROPHIES.filter((t) => on || t.id !== 'nostradamus').map((t) => {
    const won = computeTrophy(t.id);
    return { ...t, who: won?.who ?? null, detail: won?.detail ?? null };
  });
}

// ---------- Classement en direct ----------

/** Rangs avec égalités (1, 2, 2, 4) sur une liste déjà triée par points décroissants. */
function competitionRanks(points: number[]): number[] {
  return points.map((p, i) => points.indexOf(p) + 1);
}

/** « Si ça finit comme ça » : ajoute les points des matchs en cours selon le score du moment. */
export function liveProjection(): LiveProjection | null {
  const live = db
    .prepare(
      `SELECT id, week, away_score AS a, home_score AS h FROM games
       WHERE season = ? AND week >= ? AND status = 'live'`
    )
    .all(SEASON, START_WEEK) as { id: string; week: number; a: number | null; h: number | null }[];
  if (!live.length) return null;

  const base = standings();
  const extra = new Map<number, { pts: number; winning: number; losing: number }>(base.map((r) => [r.id, { pts: 0, winning: 0, losing: 0 }]));
  const pickStmt = db.prepare('SELECT player_id, side FROM picks WHERE game_id = ?');
  for (const g of live) {
    const leading = (g.a ?? 0) > (g.h ?? 0) ? 'away' : (g.h ?? 0) > (g.a ?? 0) ? 'home' : null;
    for (const p of pickStmt.all(g.id) as { player_id: number; side: string }[]) {
      const e = extra.get(p.player_id);
      if (!e || !leading) continue;
      if (p.side === leading) {
        e.pts += pointsFor(g.week);
        e.winning++;
      } else e.losing++;
    }
  }

  const rows = base
    .map((r) => {
      const e = extra.get(r.id)!;
      return { ...r, projected: r.points + e.pts, winning: e.winning, losing: e.losing, projectedRank: 0 };
    })
    .sort((x, y) => y.projected - x.projected || x.name.localeCompare(y.name, 'fr'));
  const ranks = competitionRanks(rows.map((r) => r.projected));
  rows.forEach((r, i) => (r.projectedRank = ranks[i]));
  return { games: live.length, rows };
}

// ---------- Récap de la semaine ----------

/** Dernière semaine avec au moins un match terminé (depuis la reprise). */
export function latestRecapWeek(): number | null {
  const row = db
    .prepare("SELECT MAX(week) AS w FROM games WHERE season = ? AND week >= ? AND status = 'final'")
    .get(SEASON, START_WEEK) as { w: number | null };
  return row.w;
}

export function recap(week: number): Recap {
  const counts = db
    .prepare("SELECT COUNT(*) AS total, SUM(status = 'final') AS finals FROM games WHERE season = ? AND week = ?")
    .get(SEASON, week) as { total: number; finals: number | null };
  const season = new Map(standings().map((r) => [r.id, r]));
  const rows = standings(week).map((r) => ({ ...r, seasonPoints: season.get(r.id)!.points, seasonRank: season.get(r.id)!.rank }));

  // La boulette : match terminé avec le plus de pronos ratés.
  const games = db
    .prepare(
      `SELECT g.id, g.winner, g.away_score AS a, g.home_score AS h, ta.name AS away, th.name AS home
       FROM games g JOIN teams ta ON ta.id = g.away_id JOIN teams th ON th.id = g.home_id
       WHERE g.season = ? AND g.week = ? AND g.status = 'final' AND g.winner IN ('away', 'home')`
    )
    .all(SEASON, week) as { id: string; winner: 'away' | 'home'; a: number; h: number; away: string; home: string }[];
  const pickStmt = db.prepare('SELECT k.side, p.name FROM picks k JOIN players p ON p.id = k.player_id WHERE k.game_id = ?');
  let blunder: Recap['blunder'] = null;
  for (const g of games) {
    const picks = pickStmt.all(g.id) as { side: string; name: string }[];
    const wrong = picks.filter((p) => p.side !== g.winner).map((p) => p.name);
    if (!wrong.length) continue;
    const better = !blunder || wrong.length > blunder.wrong.length || (wrong.length === blunder.wrong.length && picks.length < blunder.total);
    if (better)
      blunder = {
        away: g.away,
        home: g.home,
        awayScore: g.a,
        homeScore: g.h,
        wrongTeam: g.winner === 'away' ? g.home : g.away,
        wrong,
        total: picks.length
      };
  }

  return {
    week,
    label: weekLabel(week, true),
    complete: counts.total > 0 && counts.finals === counts.total,
    finals: counts.finals ?? 0,
    total: counts.total,
    rows,
    blunder
  };
}
