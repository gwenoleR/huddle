/**
 * Shape of the data exchanged between the server and the app.
 * One file for both: if the server changes a field, the front end stops compiling,
 * instead of showing "undefined" to the players.
 * Types only (no code): nothing from this file ends up in the bundles.
 */

/** A team's result in a game: win, loss, tie. */
export type GameResult = 'W' | 'L' | 'T';

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
  season: number;
  /** Browsable seasons, most recent first (always at least the current season). */
  seasons: number[];
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
  /** null until the trophy is awarded. */
  who: string | null;
  detail: string | null;
}

export interface SeasonDto {
  season: number;
  seasons: number[];
  startWeek: number;
  finished: boolean;
  finalGames: number;
  rows: StandingRow[];
  awards: AwardDto[];
}

export interface PreviewSideDto {
  record: string | null;
  venueRecord: string | null;
  form: { result: GameResult; opponent: string; home: boolean; score: string }[];
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
    result: GameResult | null;
  }[];
  band: { name: string; with: number; withGood: number; against: number; againstGood: number }[];
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

/** /api/games/:id: the game, plus who hasn't picked yet. */
export type GameDetailDto = GameDto & { weekLabel: string; waiting: string[]; counted: boolean };

/** /api/config: the instance's public settings (read even before login). */
export interface ConfigDto {
  appName: string;
  appShortName: string;
  /** Language of the texts (dictionaries in shared/i18n). */
  lang: string;
  points: { regular: number; playoffs: number };
}

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
  /** ESPN asked us to slow down: no more calls before this time. */
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

/** /api/admin/history: what is (or would be, on a dry run) imported. */
export interface HistoryImportDto {
  games: number;
  picks: number;
  /** Players whose starting points are replaced by the history. */
  players: string[];
  dryRun: boolean;
}

/** Any error returned by the API. */
export interface ErrorDto {
  error: string;
  /** Login: remaining attempts, or minutes before retrying is allowed. */
  attemptsLeft?: number;
  retryInMinutes?: number;
}

/** A route's possible replies: the data, or an error. */
export type Replies<T> = { 200: T; '4xx': ErrorDto; '5xx': ErrorDto };
