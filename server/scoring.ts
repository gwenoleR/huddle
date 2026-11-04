import { SEASON, START_WEEK, weekLabel } from './config';
import { db } from './db';

export interface StandingRow {
  id: number;
  name: string;
  rank: number;
  points: number;
  startPoints: number;
  good: number;
  played: number;
}

/** Barème : 1 point par bon prono en saison régulière, 2 points en playoffs (semaines 19 à 22). */
export const FIRST_PLAYOFF_WEEK = 19;
export const pointsFor = (week: number) => (week >= FIRST_PLAYOFF_WEEK ? 2 : 1);
const POINTS_SQL = `(CASE WHEN g.week >= ${FIRST_PLAYOFF_WEEK} THEN 2 ELSE 1 END)`;

/** Classement : points des bons pronos depuis la semaine de reprise, + points repris de l'ancien site (saison). */
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

  const withPoints = rows.map(({ earned, ...r }) => ({ ...r, points: (week ? 0 : r.startPoints) + earned }));
  withPoints.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'fr'));
  // Rangs à égalité : 1, 2, 2, 4
  return withPoints.map((r, i, arr) => ({
    ...r,
    rank: i > 0 && arr[i - 1].points === r.points ? 0 : i + 1
  })).map((r, i, arr) => {
    if (r.rank === 0) {
      let j = i;
      while (j > 0 && arr[j].rank === 0) j--;
      r.rank = arr[j].rank;
    }
    return r;
  });
}

export interface WeekResult {
  week: number;
  label: string;
  good: number;
  finals: number;
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

export interface Award {
  title: string;
  who: string;
  detail: string;
}

/** Trophées du bilan, calculés seulement sur les semaines jouées dans l'appli. */
export function awards(): Award[] {
  const out: Award[] = [];

  const best = db
    .prepare(
      `SELECT p.name, g.week, SUM(CASE WHEN k.side = g.winner THEN 1 ELSE 0 END) AS good, COUNT(*) AS finals
       FROM players p JOIN games g ON g.season = ? AND g.week >= ? AND g.status = 'final'
       LEFT JOIN picks k ON k.game_id = g.id AND k.player_id = p.id
       GROUP BY p.id, g.week ORDER BY good DESC, finals ASC LIMIT 1`
    )
    .get(SEASON, START_WEEK) as { name: string; week: number; good: number; finals: number } | undefined;
  if (best && best.good > 0)
    out.push({ title: 'Meilleure semaine', who: best.name, detail: `${best.good} sur ${best.finals} en ${weekLabel(best.week, true).toLowerCase()}` });

  const contrarian = db
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
    .get(SEASON, START_WEEK) as { name: string; n: number } | undefined;
  if (contrarian && contrarian.n > 0)
    out.push({ title: 'À contre-courant', who: contrarian.name, detail: `${contrarian.n} prono${contrarian.n > 1 ? 's' : ''} contre la majorité` });

  const heart = db
    .prepare(
      `SELECT p.name, t.name AS team, COUNT(*) AS n FROM picks k
       JOIN games g ON g.id = k.game_id JOIN players p ON p.id = k.player_id
       JOIN teams t ON t.id = CASE k.side WHEN 'away' THEN g.away_id ELSE g.home_id END
       WHERE g.season = ? AND g.week >= ? AND g.status = 'final'
       GROUP BY p.id, t.id ORDER BY n DESC LIMIT 1`
    )
    .get(SEASON, START_WEEK) as { name: string; team: string; n: number } | undefined;
  // Comme les autres trophées : seulement les matchs joués, et au moins 3 fois la même équipe.
  if (heart && heart.n >= 3) out.push({ title: 'Le cœur avant la tête', who: heart.name, detail: `les ${heart.team}, ${heart.n} fois` });

  return out;
}

// ---------- Classement en direct ----------

/** Rangs avec égalités (1, 2, 2, 4) sur une liste déjà triée par points décroissants. */
function competitionRanks(points: number[]): number[] {
  return points.map((p, i) => points.indexOf(p) + 1);
}

export interface LiveRow extends StandingRow {
  /** Points si les matchs en cours finissaient sur le score actuel. */
  projected: number;
  projectedRank: number;
  /** Pronos actuellement gagnants / perdants dans les matchs en cours. */
  winning: number;
  losing: number;
}

export interface LiveProjection {
  games: number;
  rows: LiveRow[];
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

export interface Recap {
  week: number;
  label: string;
  complete: boolean;
  finals: number;
  total: number;
  /** Classement de la semaine (points de la semaine) avec le total de la saison. */
  rows: (StandingRow & { seasonPoints: number; seasonRank: number })[];
  /** Le match où le plus de monde s'est trompé. */
  blunder: { away: string; home: string; awayScore: number; homeScore: number; wrongTeam: string; wrong: string[]; total: number } | null;
}

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
