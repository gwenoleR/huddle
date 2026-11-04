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

// ---------- Pendant le match (fiche match) ----------

export interface LiveInfo {
  /** Chances de victoire de l'équipe à l'extérieur (0–100) au fil du match ; t = secondes de jeu écoulées. */
  winProb: { t: number; away: number }[];
  /** Durée totale de l'axe (60 min, plus la prolongation s'il y en a une). */
  length: number;
  scoring: { side: 'away' | 'home' | null; period: number; clock: string; kind: string; text: string; away: number; home: number }[];
  /** Situation en cours, seulement pendant le match. */
  situation: { possession: 'away' | 'home' | null; down: string | null; redZone: boolean; lastPlay: string | null; lastSide: 'away' | 'home' | null } | null;
}

const toSeconds = (clock: unknown) => {
  const m = /^(\d+):(\d+)/.exec(String(clock ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
const elapsed = (period: number, clock: unknown, otLength: number) =>
  period <= 4 ? (period - 1) * 900 + (900 - toSeconds(clock)) : 3600 + (period - 5) * otLength + (otLength - toSeconds(clock));

function frenchDown(text: unknown): string | null {
  if (typeof text !== 'string' || !text) return null;
  return text
    .replace(/^1st/, '1re')
    .replace(/^(\d)(nd|rd|th)/, '$1e')
    .replace('& Goal', 'et but')
    .replace('&', 'et')
    .replace(' at ', ' · ');
}

function yards(n: unknown) {
  const v = Math.abs(Number(n) || 0);
  return `${v} yard${v > 1 ? 's' : ''}`;
}

function frenchPlay(p: any): string | null {
  const type = String(p?.type?.text ?? '');
  const y = Number(p?.statYardage ?? 0);
  switch (type) {
    case 'Rush':
      return y < 0 ? `Course, perte de ${yards(y)}` : `Course de ${yards(y)}`;
    case 'Pass Reception':
      return `Passe complétée, ${yards(y)}`;
    case 'Pass Incompletion':
      return 'Passe incomplète';
    case 'Sack':
      return `Sack, perte de ${yards(y)}`;
    case 'Punt':
      return 'Punt';
    case 'Penalty':
      return 'Pénalité';
    case 'Kickoff':
      return 'Coup d’envoi';
    case 'Timeout':
    case 'Official Timeout':
      return 'Temps mort';
    case 'Passing Touchdown':
      return 'Touchdown sur passe !';
    case 'Rushing Touchdown':
      return 'Touchdown à la course !';
    case 'Field Goal Good':
      return 'Field goal réussi';
    case 'Field Goal Missed':
    case 'Blocked Field Goal':
      return 'Field goal manqué';
    case 'Pass Interception Return':
    case 'Interception Return Touchdown':
      return 'Interception !';
    case 'Fumble Recovery (Opponent)':
    case 'Fumble Return Touchdown':
      return 'Fumble perdu !';
    case 'Fumble Recovery (Own)':
      return 'Fumble, ballon récupéré';
    case 'Two-minute warning':
      return 'Avertissement des 2 minutes';
    case 'End Period':
      return 'Fin du quart-temps';
    case 'End of Half':
      return 'Mi-temps';
    case 'Safety':
      return 'Safety !';
    default:
      return type || null;
  }
}

/** « Tucker Kraft 12 Yd pass from Jordan Love (Trey Smack Kick) » → « Passe de Jordan Love pour Tucker Kraft, 12 yards ». */
function frenchScore(kind: string, text: string): string {
  const m = /^(.+?) (\d+) Yd (.+?)\s*(?:\((.*)\))?\s*$/i.exec(text.trim());
  if (!m) return text.trim();
  const [, who, n, how] = m;
  const dist = yards(n);
  const from = /pass from (.+)/i.exec(how);
  if (from) return `Passe de ${from[1]} pour ${who}, ${dist}`;
  if (/^rush/i.test(how)) return `Course de ${who}, ${dist}`;
  if (/field goal/i.test(how)) return `${who}, ${dist}`;
  if (/interception/i.test(how)) return `Retour d’interception de ${who}, ${dist}`;
  if (/fumble/i.test(how)) return `Retour de fumble de ${who}, ${dist}`;
  if (/punt/i.test(how)) return `Retour de punt de ${who}, ${dist}`;
  if (/kickoff/i.test(how)) return `Retour de coup d’envoi de ${who}, ${dist}`;
  return `${who}, ${dist}`;
}

const SCORE_KIND: Record<string, string> = { TD: 'Touchdown', FG: 'Field goal', SF: 'Safety', S: 'Safety', XP: 'Transformation', '2PT': '2 points' };

export async function fetchLive(gameId: string, playoffs: boolean): Promise<LiveInfo> {
  const d = await getJson(`${BASE}/summary?event=${encodeURIComponent(gameId)}`);
  const comp = d.header?.competitions?.[0];
  const competitors: any[] = comp?.competitors ?? [];
  const sideOf = (teamId: unknown) => (competitors.find((c) => String(c.id) === String(teamId))?.homeAway as 'away' | 'home' | undefined) ?? null;
  const otLength = playoffs ? 900 : 600;
  const state = comp?.status?.type?.state;

  const drives: any[] = [...(d.drives?.previous ?? []), ...(d.drives?.current ? [d.drives.current] : [])];
  const plays: any[] = [];
  const seen = new Set<string>();
  for (const dr of drives)
    for (const p of dr.plays ?? [])
      if (!seen.has(String(p.id))) {
        seen.add(String(p.id));
        plays.push(p);
      }
  const byId = new Map(plays.map((p) => [String(p.id), p]));

  let maxPeriod = 4;
  const winProb: LiveInfo['winProb'] = [];
  for (const w of d.winprobability ?? []) {
    const p = byId.get(String(w.playId));
    // Les temps morts et fins de période portent parfois une valeur aberrante : on les ignore.
    if (!p || w.homeWinPercentage == null || /timeout|end period|end of half|end of game/i.test(p.type?.text ?? '')) continue;
    const period = Number(p.period?.number ?? 1);
    maxPeriod = Math.max(maxPeriod, period);
    const t = Math.max(elapsed(period, p.clock?.displayValue, otLength), winProb.at(-1)?.t ?? 0);
    winProb.push({ t, away: Math.round((1 - Number(w.homeWinPercentage)) * 1000) / 10 });
  }

  // Garde-fou : un point isolé qui saute de plus de 25 points par rapport à ses deux voisins est retiré.
  for (let i = winProb.length - 2; i > 0; i--) {
    const [a, b, c] = [winProb[i - 1].away, winProb[i].away, winProb[i + 1].away];
    if (Math.abs(b - a) > 25 && Math.abs(b - c) > 25 && Math.abs(a - c) < 25) winProb.splice(i, 1);
  }

  const scoring = (d.scoringPlays ?? []).map((s: any) => {
    const abbr = String(s.scoringType?.abbreviation ?? s.type?.abbreviation ?? '');
    const kind = SCORE_KIND[abbr] ?? s.scoringType?.displayName ?? abbr;
    return {
      side: sideOf(s.team?.id),
      period: Number(s.period?.number ?? 0),
      clock: String(s.clock?.displayValue ?? ''),
      kind,
      text: frenchScore(kind, String(s.text ?? '')),
      away: Number(s.awayScore ?? 0),
      home: Number(s.homeScore ?? 0)
    };
  });

  let situation: LiveInfo['situation'] = null;
  if (state === 'in') {
    const last = [...plays].reverse().find((p) => p.type?.text && !/timeout|end period|end of half/i.test(p.type.text)) ?? plays.at(-1);
    const end = last?.end ?? {};
    const possession = sideOf(d.drives?.current?.team?.id ?? end.team?.id);
    situation = {
      possession,
      down: frenchDown(end.downDistanceText),
      redZone: Number(end.yardsToEndzone ?? 99) <= 20,
      lastPlay: last ? frenchPlay(last) : null,
      lastSide: sideOf(last?.start?.team?.id)
    };
  }

  return { winProb, length: 3600 + Math.max(0, maxPeriod - 4) * otLength, scoring, situation };
}
