/** Mise en forme des lignes de la base pour l'API (types dans shared/api.ts). */
import type { GameDto, TeamDto } from '../../shared/api';
import { START_WEEK } from '../config';
import { db } from '../db';
import type { Me } from '../auth';
import { pointsFor } from '../scoring';

export interface TeamRow {
  id: string;
  abbr: string;
  name: string;
  display_name: string;
  color: string | null;
  alt_color: string | null;
}

export interface GameRow {
  id: string;
  week: number;
  kickoff: number;
  status: GameDto['status'];
  detail: string | null;
  away_id: string;
  home_id: string;
  away_score: number | null;
  home_score: number | null;
  winner: GameDto['winner'];
}

/** Texte noir ou blanc, selon ce qui se lit le mieux sur la couleur de l'équipe. */
export function readableOn(hex: string): string {
  const n = parseInt(hex, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 0.35 ? '#000000' : '#ffffff';
}

export function teamDto(t: TeamRow): TeamDto {
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

/** Toutes les équipes, par identifiant ESPN. */
export function teamsById(): Map<string, TeamRow> {
  return new Map((db.prepare('SELECT * FROM teams').all() as unknown as TeamRow[]).map((t) => [t.id, t]));
}

/** Un prono n'est plus possible une fois le match commencé (même si la synchro ne l'a pas encore vu). */
export const isLocked = (g: GameRow, now = Date.now()) => g.status !== 'scheduled' || g.kickoff <= now || g.week < START_WEEK;

export function gamesDto(rows: GameRow[], me: Me): GameDto[] {
  if (!rows.length) return [];
  const teams = teamsById();
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

export const playerNames = () => db.prepare('SELECT id, name FROM players ORDER BY name COLLATE NOCASE').all() as { id: number; name: string }[];
