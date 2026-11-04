/**
 * Client de l'API ESPN (non officielle, gratuite, sans clé).
 * Si elle change un jour, c'est le seul fichier à adapter.
 */
const BASE = process.env.ESPN_BASE ?? 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const UA = 'prono-entre-potes/1.0';

async function getJson(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) });
  } catch (e: any) {
    // « fetch failed » seul ne dit rien : on remonte la vraie cause (ENOTFOUND = DNS, ECONNREFUSED, délai…).
    const cause = e?.cause?.code ?? e?.cause?.message ?? (e?.name === 'TimeoutError' ? 'délai dépassé (15 s)' : e?.message);
    throw new Error(`ESPN injoignable (${cause}) : ${new URL(url).host}`);
  }
  if (!res.ok) throw new Error(`ESPN a répondu ${res.status} sur ${url}`);
  return res.json();
}

export interface EspnTeam {
  id: string;
  abbr: string;
  name: string;
  displayName: string;
  color: string | null;
  altColor: string | null;
}

export type GameStatus = 'scheduled' | 'live' | 'final' | 'postponed';

export interface EspnGame {
  id: string;
  week: number;
  kickoff: number;
  status: GameStatus;
  detail: string | null;
  awayId: string;
  homeId: string;
  awayScore: number | null;
  homeScore: number | null;
  winner: 'away' | 'home' | 'tie' | null;
}

export function logoUrl(abbr: string, dark = false) {
  return `https://a.espncdn.com/i/teamlogos/nfl/500${dark ? '-dark' : ''}/scoreboard/${abbr.toLowerCase()}.png`;
}

export async function fetchTeams(): Promise<EspnTeam[]> {
  const d = await getJson(`${BASE}/teams`);
  return d.sports[0].leagues[0].teams.map(({ team: t }: any) => ({
    id: String(t.id),
    abbr: t.abbreviation,
    name: t.name ?? t.shortDisplayName,
    displayName: t.displayName,
    color: t.color ?? null,
    altColor: t.alternateColor ?? null
  }));
}

/** ESPN : saison régulière = type 2, semaines 1–18 ; playoffs = type 3, semaines 1, 2, 3 et 5 (la 4 est le Pro Bowl). */
const POST_TO_APP: Record<number, number> = { 1: 19, 2: 20, 3: 21, 5: 22 };

export function toAppWeek(seasonType: number, week: number): number | null {
  if (seasonType === 2 && week >= 1 && week <= 18) return week;
  if (seasonType === 3) return POST_TO_APP[week] ?? null;
  return null;
}

export function fromAppWeek(week: number): { seasonType: number; week: number } {
  if (week <= 18) return { seasonType: 2, week };
  const espnWeek = Number(Object.entries(POST_TO_APP).find(([, v]) => v === week)?.[0]);
  return { seasonType: 3, week: espnWeek };
}

export const APP_WEEKS = [...Array.from({ length: 18 }, (_, i) => i + 1), 19, 20, 21, 22];

export async function fetchWeek(season: number, appWeek: number): Promise<EspnGame[]> {
  const { seasonType, week } = fromAppWeek(appWeek);
  const d = await getJson(`${BASE}/scoreboard?seasontype=${seasonType}&week=${week}&dates=${season}`);
  return (d.events ?? []).map((e: any) => parseEvent(e, appWeek)).filter(Boolean) as EspnGame[];
}

function frenchDetail(status: any, state: GameStatus): string | null {
  const type = status?.type ?? {};
  const period = Number(status?.period ?? 0);
  if (state === 'final') return period > 4 || /OT/.test(type.detail ?? '') ? 'Terminé · prol.' : 'Terminé';
  if (state === 'postponed') return 'Reporté';
  if (state !== 'live') return null;
  if (type.name === 'STATUS_HALFTIME') return 'Mi-temps';
  const q = period > 4 ? 'Prol.' : `Q${period}`;
  if (type.name === 'STATUS_END_PERIOD') return `Fin ${q}`;
  return status?.displayClock ? `${q} · ${status.displayClock}` : q;
}

function parseEvent(e: any, week: number): EspnGame | null {
  const c = e.competitions?.[0];
  if (!c) return null;
  const away = c.competitors?.find((x: any) => x.homeAway === 'away');
  const home = c.competitors?.find((x: any) => x.homeAway === 'home');
  if (!away || !home) return null;

  const type = e.status?.type ?? {};
  let status: GameStatus = type.state === 'post' ? 'final' : type.state === 'in' ? 'live' : 'scheduled';
  if (/POSTPONED|CANCELED|SUSPENDED/.test(type.name ?? '')) status = 'postponed';

  const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
  const awayScore = status === 'scheduled' || status === 'postponed' ? null : num(away.score);
  const homeScore = status === 'scheduled' || status === 'postponed' ? null : num(home.score);

  let winner: EspnGame['winner'] = null;
  if (status === 'final') {
    if (away.winner) winner = 'away';
    else if (home.winner) winner = 'home';
    else if (awayScore != null && awayScore === homeScore) winner = 'tie';
  }

  return {
    id: String(e.id),
    week,
    kickoff: Date.parse(e.date),
    status,
    detail: frenchDetail(e.status, status),
    awayId: String(away.team.id),
    homeId: String(home.team.id),
    awayScore,
    homeScore,
    winner
  };
}
