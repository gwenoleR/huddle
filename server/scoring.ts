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
       WHERE g.season = ? AND g.week >= ?
       GROUP BY p.id, t.id ORDER BY n DESC LIMIT 1`
    )
    .get(SEASON, START_WEEK) as { name: string; team: string; n: number } | undefined;
  if (heart && heart.n > 1) out.push({ title: 'Le cœur avant la tête', who: heart.name, detail: `les ${heart.team}, ${heart.n} fois` });

  return out;
}
