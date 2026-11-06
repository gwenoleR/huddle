/**
 * Client de l'API ESPN (non officielle, gratuite, sans clé).
 * Si elle change un jour, c'est le seul fichier à adapter.
 */
import type { EspnStatsDto, LiveDto, NflTeamRow, PreviewDto, PreviewSideDto } from '../shared/api';
import { t } from './config';

export type PreviewSide = PreviewSideDto;
/** L'avant-match tel qu'ESPN le donne ; la place au classement est ajoutée par la route. */
export type Preview = Omit<PreviewDto, 'standing'>;
export type LiveInfo = LiveDto;
/** Une équipe au classement, sans sa fiche (ajoutée par la route depuis la base). */
export type StandingTeam = Omit<NflTeamRow, 'team'>;
export interface NflStandings {
  conferences: { abbr: string; divisions: { name: string; teams: StandingTeam[] }[] }[];
}

const BASE = process.env.ESPN_BASE ?? 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const UA = 'prono-entre-potes/1.0';

// ---------- Appels à ESPN : compteur et pause ----------

/** Horodatage de chaque appel (et des erreurs) sur les dernières 24 h, pour l'écran admin. */
const calls: number[] = [];
const failures: number[] = [];
let pausedUntil = 0;
let strikes = 0;
const PAUSE_BASE = 5 * 60_000;
const PAUSE_MAX = 60 * 60_000;

function remember(list: number[], now: number) {
  list.push(now);
  while (list.length && list[0] < now - 24 * 3600_000) list.shift();
}

export function espnStats(now = Date.now()): EspnStatsDto {
  const hour = (list: number[]) => list.filter((at) => at > now - 3600_000).length;
  return {
    lastHour: hour(calls),
    lastDay: calls.filter((at) => at > now - 24 * 3600_000).length,
    errorsLastHour: hour(failures),
    pausedUntil: pausedUntil > now ? pausedUntil : null
  };
}

/** Pour les tests. */
export function resetEspnStats() {
  calls.length = failures.length = 0;
  pausedUntil = strikes = 0;
}

async function getJson(url: string): Promise<any> {
  const now = Date.now();
  if (now < pausedUntil) {
    const min = Math.ceil((pausedUntil - now) / 60_000);
    throw new Error(t.sync.espnPaused(min));
  }
  remember(calls, now);
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) });
  } catch (e: any) {
    remember(failures, now);
    // « fetch failed » seul ne dit rien : on remonte la vraie cause (ENOTFOUND = DNS, ECONNREFUSED, délai…).
    const cause = e?.cause?.code ?? e?.cause?.message ?? (e?.name === 'TimeoutError' ? t.sync.espnTimeout : e?.message);
    throw new Error(t.sync.espnUnreachable(cause, new URL(url).host));
  }
  if (res.status === 429) {
    // ESPN demande de ralentir : on s'arrête 5 min, puis 10, 20… jusqu'à 1 h si ça se répète.
    remember(failures, now);
    pausedUntil = now + Math.min(PAUSE_BASE * 2 ** strikes, PAUSE_MAX);
    strikes++;
    console.warn(`[espn] 429 : pause jusqu'à ${new Date(pausedUntil).toISOString()}`);
    throw new Error(t.sync.espnTooManyCalls);
  }
  if (!res.ok) {
    remember(failures, now);
    throw new Error(t.sync.espnHttpError(res.status, url));
  }
  strikes = 0;
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

/** Ligne d'état d'un match (« Q3 · 4:12 », « Mi-temps », « Terminé »), dans la langue de l'instance. */
function gameDetail(status: any, state: GameStatus): string | null {
  const type = status?.type ?? {};
  const period = Number(status?.period ?? 0);
  if (state === 'final') return t.espn.detail.final(period > 4 || /OT/.test(type.detail ?? ''));
  if (state === 'postponed') return t.espn.detail.postponed;
  if (state !== 'live') return null;
  if (type.name === 'STATUS_HALFTIME') return t.espn.detail.halftime;
  if (type.name === 'STATUS_END_PERIOD') return t.espn.detail.endOfPeriod(period);
  return t.espn.detail.running(period, status?.displayClock || null);
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
    detail: gameDetail(e.status, status),
    awayId: String(away.team.id),
    homeId: String(home.team.id),
    awayScore,
    homeScore,
    winner
  };
}

// ---------- Avant-match (fiche match) ----------

function injuryPart(type: unknown): string | null {
  if (typeof type !== 'string' || !type) return null;
  const main = type.split(' - ')[0].trim().toLowerCase();
  return t.espn.bodyParts[main] ?? type;
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

    const last = (d.lastFiveGames ?? []).find((x: any) => String(x.team?.id) === id);
    const form = (last?.events ?? []).map((e: any) => ({
      result: e.gameResult === 'W' ? 'V' : e.gameResult === 'L' ? 'D' : 'N',
      opponent: e.opponent?.abbreviation ?? '?',
      home: e.atVs !== '@',
      score: e.score ?? ''
    }));

    const proj = homeAway === 'home' ? d.predictor?.homeTeam : d.predictor?.awayTeam;
    const winChance = proj?.gameProjection != null && !Number.isNaN(Number(proj.gameProjection)) ? Math.round(Number(proj.gameProjection)) : null;

    const inj = (d.injuries ?? []).find((x: any) => String(x.team?.id) === id)?.injuries ?? [];
    const injuries = inj
      .map((i: any) => ({
        name: i.athlete?.displayName ?? i.athlete?.shortName ?? '?',
        position: i.athlete?.position?.abbreviation ?? null,
        status: STATUS[String(i.status ?? '').toLowerCase()],
        part: injuryPart(i.details?.type)
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
    odds = { favorite: (favId && sideOf(favId)) || null, spread: spread || null, provider: pc.provider?.name ?? t.espn.defaultProvider };
  }

  return { away: side('away'), home: side('home'), odds };
}

// ---------- Pendant le match (fiche match) ----------

const toSeconds = (clock: unknown) => {
  const m = /^(\d+):(\d+)/.exec(String(clock ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
const elapsed = (period: number, clock: unknown, otLength: number) =>
  period <= 4 ? (period - 1) * 900 + (900 - toSeconds(clock)) : 3600 + (period - 5) * otLength + (otLength - toSeconds(clock));

function downText(text: unknown): string | null {
  return typeof text === 'string' && text ? t.espn.down(text) : null;
}

function playText(p: any): string | null {
  return t.espn.play(String(p?.type?.text ?? ''), Number(p?.statYardage ?? 0));
}

/** Stats comparées, dans l'ordre d'affichage ; les libellés sont dans le dictionnaire (t.espn.stats). */
const STAT_ROWS: { key: keyof typeof t.espn.stats; lowerIsBetter?: boolean; show?: (v: string) => string; value?: (v: string) => number }[] = [
  { key: 'totalYards' },
  { key: 'netPassingYards' },
  { key: 'rushingYards' },
  { key: 'firstDowns' },
  { key: 'thirdDownEff', show: (v) => v.replace('-', '/'), value: (v) => ratio(v) },
  { key: 'redZoneAttempts', show: (v) => v.replace('-', '/'), value: (v) => ratio(v) },
  { key: 'turnovers', lowerIsBetter: true },
  { key: 'sacksYardsLost', lowerIsBetter: true, show: (v) => v.split('-')[0], value: (v) => Number(v.split('-')[0]) },
  {
    key: 'totalPenaltiesYards',
    lowerIsBetter: true,
    show: (v) => {
      const [n, y] = v.split('-');
      return y ? t.espn.penalties(n, y) : n;
    },
    value: (v) => Number(v.split('-')[1] ?? v.split('-')[0])
  },
  { key: 'possessionTime', show: (v) => t.espn.possession(v), value: (v) => toSeconds(v) }
];
function ratio(v: string) {
  const [a, b] = v.split('-').map(Number);
  return b ? a / b : 0;
}

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
    const at = Math.max(elapsed(period, p.clock?.displayValue, otLength), winProb.at(-1)?.t ?? 0);
    winProb.push({ t: at, away: Math.round((1 - Number(w.homeWinPercentage)) * 1000) / 10 });
  }

  // Garde-fou : un point isolé qui saute de plus de 25 points par rapport à ses deux voisins est retiré.
  for (let i = winProb.length - 2; i > 0; i--) {
    const [a, b, c] = [winProb[i - 1].away, winProb[i].away, winProb[i + 1].away];
    if (Math.abs(b - a) > 25 && Math.abs(b - c) > 25 && Math.abs(a - c) < 25) winProb.splice(i, 1);
  }

  const scoring = (d.scoringPlays ?? []).map((s: any) => {
    const abbr = String(s.scoringType?.abbreviation ?? s.type?.abbreviation ?? '');
    const kind = t.espn.scoreKinds[abbr] ?? s.scoringType?.displayName ?? abbr;
    return {
      side: sideOf(s.team?.id),
      period: Number(s.period?.number ?? 0),
      clock: String(s.clock?.displayValue ?? ''),
      kind,
      text: t.espn.scoringPlay(String(s.text ?? '')),
      away: Number(s.awayScore ?? 0),
      home: Number(s.homeScore ?? 0)
    };
  });

  const teamStats = (side: 'away' | 'home') => {
    const box = (d.boxscore?.teams ?? []).find((x: any) => x.homeAway === side || sideOf(x.team?.id) === side);
    return new Map<string, string>((box?.statistics ?? []).map((st: any) => [st.name, String(st.displayValue ?? '')]));
  };
  const sa = teamStats('away');
  const sh = teamStats('home');
  const stats: LiveInfo['stats'] = [];
  for (const r of STAT_ROWS) {
    const a = sa.get(r.key);
    const h = sh.get(r.key);
    if (a == null || h == null || a === '' || h === '') continue;
    const val = r.value ?? ((v: string) => Number(v));
    const show = r.show ?? ((v: string) => v);
    stats.push({ label: t.espn.stats[r.key], away: show(a), home: show(h), awayValue: val(a) || 0, homeValue: val(h) || 0, lowerIsBetter: !!r.lowerIsBetter });
  }

  const leaderOf = (side: 'away' | 'home', cat: string) => {
    const team = (d.leaders ?? []).find((x: any) => sideOf(x.team?.id) === side);
    const l = team?.leaders?.find((x: any) => x.name === cat)?.leaders?.[0];
    return l ? { name: String(l.athlete?.displayName ?? '?'), line: t.espn.leaderLine(String(l.displayValue ?? '')) } : null;
  };
  const leaders = Object.entries(t.espn.leaderCategories)
    .map(([cat, category]) => ({ category, away: leaderOf('away', cat), home: leaderOf('home', cat) }))
    .filter((l) => l.away || l.home);

  let situation: LiveInfo['situation'] = null;
  if (state === 'in') {
    const last = [...plays].reverse().find((p) => p.type?.text && !/timeout|end period|end of half/i.test(p.type.text)) ?? plays.at(-1);
    const end = last?.end ?? {};
    const possession = sideOf(d.drives?.current?.team?.id ?? end.team?.id);
    situation = {
      possession,
      down: downText(end.downDistanceText),
      redZone: Number(end.yardsToEndzone ?? 99) <= 20,
      lastPlay: last ? playText(last) : null,
      lastSide: sideOf(last?.start?.team?.id)
    };
  }

  return { winProb, length: 3600 + Math.max(0, maxPeriod - 4) * otLength, scoring, stats, leaders, situation };
}

// ---------- Classement NFL ----------

function streakText(v: unknown): string | null {
  const m = /^([WLT])(\d+)$/.exec(String(v ?? ''));
  return m ? t.espn.streak(m[1] as 'W' | 'L' | 'T', m[2]) : null;
}

export async function fetchStandings(season: number): Promise<NflStandings> {
  const d = await getJson(`${BASE.replace('/apis/site/v2/', '/apis/v2/')}/standings?season=${season}&level=3`);
  const conferences = (d.children ?? []).map((conf: any) => ({
    abbr: String(conf.abbreviation ?? conf.name),
    divisions: (conf.children ?? []).map((div: any) => {
      const [c, dir] = String(div.name ?? '').split(' ');
      return {
        name: `${c} ${t.espn.directions[dir] ?? dir ?? ''}`.trim(),
        teams: (div.standings?.entries ?? []).map((e: any, i: number) => {
          const stat = (name: string) => e.stats?.find((s: any) => s.name === name || s.type === name)?.displayValue ?? null;
          const clincher = String(stat('clincher') ?? '').trim().toLowerCase();
          return {
            teamId: String(e.team?.id),
            record: stat('overall') ?? `${stat('wins') ?? 0}-${stat('losses') ?? 0}`,
            streak: streakText(stat('streak')),
            seed: stat('playoffSeed') ? Number(stat('playoffSeed')) : null,
            diff: stat('differential') ?? stat('pointDifferential'),
            divRecord: stat('vs. Div.') ?? stat('divisionRecord'),
            divRank: i + 1,
            clinch: clincher === 'e' ? 'out' : clincher ? 'in' : null
          } satisfies StandingTeam;
        })
      };
    })
  }));
  return { conferences };
}
