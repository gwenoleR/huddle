export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? 'GET',
      headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin'
    });
  } catch {
    throw new ApiError(0, 'Pas de réseau. Réessaie dans un instant.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'Oups, le serveur fait des siennes.', data);
  return data as T;
}

// ---------- Types renvoyés par le serveur ----------

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
  status: 'scheduled' | 'live' | 'final' | 'postponed';
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
}

export interface LiveDto {
  winProb: { t: number; away: number }[];
  length: number;
  scoring: { side: 'away' | 'home' | null; period: number; clock: string; kind: string; text: string; away: number; home: number }[];
  stats: { label: string; away: string; home: string; awayValue: number; homeValue: number; lowerIsBetter: boolean }[];
  leaders: { category: string; away: { name: string; line: string } | null; home: { name: string; line: string } | null }[];
  situation: { possession: 'away' | 'home' | null; down: string | null; redZone: boolean; lastPlay: string | null; lastSide: 'away' | 'home' | null } | null;
}
