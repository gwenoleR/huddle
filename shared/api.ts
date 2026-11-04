/**
 * Forme des données échangées entre le serveur et l'appli.
 * Un seul fichier pour les deux : si le serveur change un champ, le front ne compile plus,
 * au lieu d'afficher « undefined » chez les potes.
 * Uniquement des types (aucun code) : rien de ce fichier n'arrive dans les bundles.
 */

export type Side = 'away' | 'home';
export type GameStatus = 'scheduled' | 'live' | 'final' | 'postponed';

export interface TeamDto {
  abbr: string;
  name: string;
  fullName: string;
  color: string;
  textColor: string;
  logo: string;
  logoDark: string;
}

export interface GameDto {
  id: string;
  week: number;
  kickoff: number;
  status: GameStatus;
  detail: string | null;
  locked: boolean;
  points: number;
  away: TeamDto;
  home: TeamDto;
  score: { away: number; home: number } | null;
  winner: 'away' | 'home' | 'tie' | null;
  myPick: 'away' | 'home' | null;
  pickers: { away: string[]; home: string[] };
}

export interface Me {
  id: number;
  name: string;
  isAdmin: boolean;
}

export interface PlayerLite {
  id: number;
  name: string;
  hasPin: boolean;
}

export interface WeeksDto {
  season: number;
  startWeek: number;
  current: number;
  weeks: { week: number; label: string; longLabel: string; points: number }[];
}

export interface StandingRow {
  id: number;
  name: string;
  rank: number;
  points: number;
  startPoints: number;
  good: number;
  played: number;
  bonus: number;
}

export interface LiveRow extends StandingRow {
  projected: number;
  projectedRank: number;
  winning: number;
  losing: number;
}

export interface LeaderboardDto {
  week: number | null;
  startWeek: number;
  rows: StandingRow[];
  live: { games: number; rows: LiveRow[] } | null;
}

export interface RecapDto {
  week: number;
  label: string;
  complete: boolean;
  finals: number;
  total: number;
  rows: (StandingRow & { seasonPoints: number; seasonRank: number })[];
  blunder: { away: string; home: string; awayScore: number; homeScore: number; wrongTeam: string; wrong: string[]; total: number } | null;
}

export interface ProfileDto extends Me {
  season: number;
  startWeek: number;
  players: number;
  rank: number;
  points: number;
  startPoints: number;
  good: number;
  played: number;
  streak: number;
  weeks: { week: number; label: string; good: number; finals: number }[];
}

export interface AwardDto {
  id: string;
  title: string;
  rule: string;
  /** null tant que le trophée n'est pas attribué. */
  who: string | null;
  detail: string | null;
}

export interface SeasonDto {
  season: number;
  startWeek: number;
  finished: boolean;
  finalGames: number;
  rows: StandingRow[];
  awards: AwardDto[];
}

export interface PreviewSideDto {
  record: string | null;
  venueRecord: string | null;
  form: { result: 'V' | 'D' | 'N'; opponent: string; home: boolean; score: string }[];
  winChance: number | null;
  injuries: { name: string; position: string | null; status: 'out' | 'doubtful' | 'questionable'; part: string | null }[];
  injuredReserve: number;
}

export interface PreviewDto {
  away: PreviewSideDto;
  home: PreviewSideDto;
  odds: { favorite: 'away' | 'home' | null; spread: number | null; provider: string } | null;
  standing: { away: TeamStandingDto | null; home: TeamStandingDto | null } | null;
}

export interface TeamStandingDto {
  conference: string;
  division: string;
  divRank: number;
  seed: number | null;
  clinch: 'in' | 'out' | null;
}

export interface NflTeamRow {
  teamId: string;
  team: TeamDto;
  record: string;
  streak: string | null;
  seed: number | null;
  diff: string | null;
  divRecord: string | null;
  divRank: number;
  clinch: 'in' | 'out' | null;
}

export interface NflStandingsDto {
  season: number;
  conferences: { abbr: string; divisions: { name: string; teams: NflTeamRow[] }[]; seeds: (NflTeamRow & { division: string })[] }[];
}

export interface LiveDto {
  winProb: { t: number; away: number }[];
  length: number;
  scoring: { side: 'away' | 'home' | null; period: number; clock: string; kind: string; text: string; away: number; home: number }[];
  stats: { label: string; away: string; home: string; awayValue: number; homeValue: number; lowerIsBetter: boolean }[];
  leaders: { category: string; away: { name: string; line: string } | null; home: { name: string; line: string } | null }[];
  situation: { possession: 'away' | 'home' | null; down: string | null; redZone: boolean; lastPlay: string | null; lastSide: 'away' | 'home' | null } | null;
}

export interface TeamSheetDto {
  team: TeamDto;
  record: string;
  standing: TeamStandingDto | null;
  schedule: {
    id: string;
    week: number;
    weekLabel: string;
    kickoff: number;
    status: GameDto['status'];
    detail: string | null;
    home: boolean;
    opponent: TeamDto;
    score: string | null;
    result: 'V' | 'D' | 'N' | null;
  }[];
  bande: { name: string; with: number; withGood: number; against: number; againstGood: number }[];
}

export interface BonusDto {
  enabled: boolean;
  points: { afc: number; nfc: number; sb: number };
  reveal: BonusReveal;
  phase: BonusPhase;
  lockAt: number | null;
  revealed: boolean;
  revealAt: number | null;
  field: { afc: { seed: number; team: TeamDto }[]; nfc: { seed: number; team: TeamDto }[] } | null;
  mine: BonusPickDto | null;
  players: { name: string; done: boolean; pick: BonusPickDto | null; points: number | null }[];
  result: { afc: TeamDto | null; nfc: TeamDto | null; sb: TeamDto | null; sbTotal: number | null };
}

export interface BonusPickDto {
  afc: TeamDto | null;
  nfc: TeamDto | null;
  sb: TeamDto | null;
  sbTotal: number;
}

/** /api/weeks/:week */
export interface WeekDto {
  week: number;
  label: string;
  points: number;
  games: GameDto[];
}

/** /api/games/:id : le match, plus qui n'a pas encore pronostiqué. */
export type GameDetailDto = GameDto & { weekLabel: string; waiting: string[]; counted: boolean };

export interface HealthDto {
  ok: true;
  version: string;
}

export interface OkDto {
  ok: true;
  created?: boolean;
}

export interface EspnStatsDto {
  lastHour: number;
  lastDay: number;
  errorsLastHour: number;
  /** ESPN a demandé de ralentir : plus aucun appel avant cette heure. */
  pausedUntil: number | null;
}

/** /api/admin/sync */
export interface SyncStatusDto {
  at: number | null;
  ok: boolean;
  message: string;
  games: number;
  espn?: EspnStatsDto;
}

export type BonusReveal = 'wildcard' | 'superbowl';
export type BonusPhase = 'off' | 'waiting' | 'open' | 'locked';

/** /api/admin/bonus */
export interface BonusSettingsDto {
  enabled: boolean;
  points: { afc: number; nfc: number; sb: number };
  reveal: BonusReveal;
}

/** /api/admin/players */
export interface AdminPlayerDto {
  id: number;
  name: string;
  startPoints: number;
  isAdmin: boolean;
  hasPin: boolean;
}

/** Toute erreur renvoyée par l'API. */
export interface ErrorDto {
  error: string;
  /** Connexion : essais restants, ou minutes avant de pouvoir réessayer. */
  attemptsLeft?: number;
  retryInMinutes?: number;
}

/** Réponses possibles d'une route : la donnée, ou une erreur. */
export type Replies<T> = { 200: T; '4xx': ErrorDto; '5xx': ErrorDto };
