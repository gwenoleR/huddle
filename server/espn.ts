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

// ---------- Avant-match (fiche match) ----------

export interface PreviewSide {
  record: string | null;
  /** Bilan à domicile pour l'équipe qui reçoit, à l'extérieur pour l'autre. */
  venueRecord: string | null;
  /** 5 derniers matchs, du plus ancien au plus récent. */
  form: { result: 'V' | 'D' | 'N'; opponent: string; home: boolean; score: string }[];
  winChance: number | null;
  injuries: { name: string; position: string | null; status: 'out' | 'doubtful' | 'questionable'; part: string | null }[];
  injuredReserve: number;
}

export interface Preview {
  away: PreviewSide;
  home: PreviewSide;
  odds: { favorite: 'away' | 'home' | null; spread: number | null; provider: string } | null;
}

const BODY_PARTS: Record<string, string> = {
  knee: 'genou', ankle: 'cheville', hamstring: 'ischios', concussion: 'commotion', shoulder: 'épaule', groin: 'aine',
  calf: 'mollet', back: 'dos', foot: 'pied', hip: 'hanche', quadriceps: 'quadriceps', ribs: 'côtes', thumb: 'pouce',
  hand: 'main', wrist: 'poignet', elbow: 'coude', neck: 'cou', chest: 'poitrine', illness: 'malade', toe: 'orteil',
  achilles: 'tendon d’Achille', pectoral: 'pectoral', abdomen: 'abdomen', oblique: 'oblique', 'lower leg': 'jambe',
  'lower back': 'bas du dos', heel: 'talon', finger: 'doigt', head: 'tête', face: 'visage', eye: 'œil', arm: 'bras',
  forearm: 'avant-bras', biceps: 'biceps', triceps: 'triceps', thigh: 'cuisse', shin: 'tibia', personal: 'raisons perso',
  rest: 'repos', 'not injury related': 'hors blessure', jaw: 'mâchoire', nose: 'nez', glute: 'fessier', leg: 'jambe'
};

function frenchPart(type: unknown): string | null {
  if (typeof type !== 'string' || !type) return null;
  const main = type.split(' - ')[0].trim().toLowerCase();
  return BODY_PARTS[main] ?? type;
}

const STATUS: Record<string, PreviewSide['injuries'][number]['status']> = {
  out: 'out',
  doubtful: 'doubtful',
  questionable: 'questionable'
};
const SEVERITY = { out: 0, doubtful: 1, questionable: 2 };
/** Les postes qui font le plus basculer un match passent en premier. */
const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C', 'DE', 'DT', 'LB', 'CB', 'S', 'K', 'P'];
const posRank = (p: string | null) => {
  const i = POSITION_ORDER.indexOf(p ?? '');
  return i < 0 ? 99 : i;
};

export async function fetchPreview(gameId: string): Promise<Preview> {
  const d = await getJson(`${BASE}/summary?event=${encodeURIComponent(gameId)}`);
  const comp = d.header?.competitions?.[0];
  const competitors: any[] = comp?.competitors ?? [];
  const sideOf = (teamId: unknown) => competitors.find((c) => String(c.id) === String(teamId))?.homeAway as 'away' | 'home' | undefined;

  const side = (homeAway: 'away' | 'home'): PreviewSide => {
    const c = competitors.find((x) => x.homeAway === homeAway);
    const id = String(c?.id ?? '');
    const records: any[] = c?.record ?? [];
    const rec = (type: string) => records.find((r) => r.type === type)?.summary ?? null;

    const last = (d.lastFiveGames ?? []).find((t: any) => String(t.team?.id) === id);
    const form = (last?.events ?? []).map((e: any) => ({
      result: e.gameResult === 'W' ? 'V' : e.gameResult === 'L' ? 'D' : 'N',
      opponent: e.opponent?.abbreviation ?? '?',
      home: e.atVs !== '@',
      score: e.score ?? ''
    }));

    const proj = homeAway === 'home' ? d.predictor?.homeTeam : d.predictor?.awayTeam;
    const winChance = proj?.gameProjection != null && !Number.isNaN(Number(proj.gameProjection)) ? Math.round(Number(proj.gameProjection)) : null;

    const inj = (d.injuries ?? []).find((t: any) => String(t.team?.id) === id)?.injuries ?? [];
    const injuries = inj
      .map((i: any) => ({
        name: i.athlete?.displayName ?? i.athlete?.shortName ?? '?',
        position: i.athlete?.position?.abbreviation ?? null,
        status: STATUS[String(i.status ?? '').toLowerCase()],
        part: frenchPart(i.details?.type)
      }))
      .filter((i: any) => i.status)
      .sort((a: any, b: any) => SEVERITY[a.status as keyof typeof SEVERITY] - SEVERITY[b.status as keyof typeof SEVERITY] || posRank(a.position) - posRank(b.position));
    const injuredReserve = inj.filter((i: any) => /reserve/i.test(String(i.status ?? ''))).length;

    return { record: rec('total'), venueRecord: rec(homeAway === 'home' ? 'home' : 'road'), form, winChance, injuries, injuredReserve };
  };

  let odds: Preview['odds'] = null;
  const pc = d.pickcenter?.[0];
  if (pc) {
    const favId = pc.homeTeamOdds?.favorite ? pc.homeTeamOdds?.teamId : pc.awayTeamOdds?.favorite ? pc.awayTeamOdds?.teamId : null;
    const m = /-(\d+(?:\.\d+)?)/.exec(String(pc.details ?? ''));
    const spread = m ? Number(m[1]) : null;
    odds = { favorite: (favId && sideOf(favId)) || null, spread: spread || null, provider: pc.provider?.name ?? 'Bookmakers' };
  }

  return { away: side('away'), home: side('home'), odds };
}
