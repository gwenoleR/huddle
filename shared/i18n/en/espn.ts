/**
 * Texts derived from ESPN data (in English): game status, injuries, plays, stats,
 * standings. Each function receives ESPN's raw data and returns the sentence in the language.
 */
import type { Messages } from '../index';

const yards = (n: unknown) => {
  const v = Math.abs(Number(n) || 0);
  return `${v} yard${v === 1 ? '' : 's'}`;
};

/** Quarter: "Q3", overtime "OT". */
const quarter = (period: number) => (period > 4 ? 'OT' : `Q${period}`);

export const espn = {
  /** Status line under the score, stored with the game. */
  detail: {
    final: (overtime: boolean) => (overtime ? 'Final/OT' : 'Final'),
    postponed: 'Postponed',
    halftime: 'Halftime',
    endOfPeriod: (period: number) => `End of ${quarter(period)}`,
    running: (period: number, clock: string | null) => (clock ? `${quarter(period)} · ${clock}` : quarter(period)),
    /** Is the game in its last quarter or in overtime? (reads the texts above) */
    isLate: (detail: string | null) => /^(Q4|End of Q4|OT|End of OT)/.test(detail ?? '')
  },

  /** Body part of an injury (ESPN's text as is if unknown). */
  bodyParts: {
    knee: 'knee', ankle: 'ankle', hamstring: 'hamstring', concussion: 'concussion', shoulder: 'shoulder', groin: 'groin',
    calf: 'calf', back: 'back', foot: 'foot', hip: 'hip', quadriceps: 'quad', ribs: 'ribs', thumb: 'thumb',
    hand: 'hand', wrist: 'wrist', elbow: 'elbow', neck: 'neck', chest: 'chest', illness: 'illness', toe: 'toe',
    achilles: 'Achilles', pectoral: 'pec', abdomen: 'abdomen', oblique: 'oblique', 'lower leg': 'lower leg',
    'lower back': 'lower back', heel: 'heel', finger: 'finger', head: 'head', face: 'face', eye: 'eye', arm: 'arm',
    forearm: 'forearm', biceps: 'biceps', triceps: 'triceps', thigh: 'thigh', shin: 'shin', personal: 'personal',
    rest: 'rest', 'not injury related': 'not injury related', jaw: 'jaw', nose: 'nose', glute: 'glute', leg: 'leg'
  } as Record<string, string>,

  /** Bookmaker when ESPN doesn't name one. */
  defaultProvider: 'Sportsbooks',

  /** "3rd & 7 at GB 35" → "3rd & 7 · GB 35" */
  down: (text: string) => text.replace(' at ', ' · '),

  /** Last play, based on its ESPN type (the type as is if unknown). */
  play: (type: string, yardage: number): string | null => {
    switch (type) {
      case 'Rush':
        return yardage < 0 ? `Run for a loss of ${yards(yardage)}` : `Run for ${yards(yardage)}`;
      case 'Pass Reception':
        return `Pass complete for ${yards(yardage)}`;
      case 'Pass Incompletion':
        return 'Incomplete pass';
      case 'Sack':
        return `Sacked for a loss of ${yards(yardage)}`;
      case 'Punt':
        return 'Punt';
      case 'Penalty':
        return 'Penalty';
      case 'Kickoff':
        return 'Kickoff';
      case 'Timeout':
      case 'Official Timeout':
        return 'Timeout';
      case 'Passing Touchdown':
        return 'Touchdown pass!';
      case 'Rushing Touchdown':
        return 'Rushing touchdown!';
      case 'Field Goal Good':
        return 'Field goal is good';
      case 'Field Goal Missed':
      case 'Blocked Field Goal':
        return 'Field goal no good';
      case 'Pass Interception Return':
      case 'Interception Return Touchdown':
        return 'Interception!';
      case 'Fumble Recovery (Opponent)':
      case 'Fumble Return Touchdown':
        return 'Fumble, turnover!';
      case 'Fumble Recovery (Own)':
        return 'Fumble, recovered';
      case 'Two-minute warning':
        return 'Two-minute warning';
      case 'End Period':
        return 'End of quarter';
      case 'End of Half':
        return 'Halftime';
      case 'Safety':
        return 'Safety!';
      default:
        return type || null;
    }
  },

  /** "Tucker Kraft 12 Yd pass from Jordan Love (Trey Smack Kick)" → "Jordan Love 12-yard pass to Tucker Kraft". */
  scoringPlay: (text: string) => {
    const m = /^(.+?) (\d+) Yd (.+?)\s*(?:\((.*)\))?\s*$/i.exec(text.trim());
    if (!m) return text.trim();
    const [, who, n, how] = m;
    const dist = `${Math.abs(Number(n) || 0)}-yard`;
    const from = /pass from (.+)/i.exec(how);
    if (from) return `${from[1]} ${dist} pass to ${who}`;
    if (/^rush/i.test(how)) return `${who} ${dist} run`;
    if (/field goal/i.test(how)) return `${who} ${dist} field goal`;
    if (/interception/i.test(how)) return `${who} ${dist} interception return`;
    if (/fumble/i.test(how)) return `${who} ${dist} fumble return`;
    if (/punt/i.test(how)) return `${who} ${dist} punt return`;
    if (/kickoff/i.test(how)) return `${who} ${dist} kickoff return`;
    return `${who}, ${yards(n)}`;
  },

  /** Type of score (ESPN abbreviation). */
  scoreKinds: { TD: 'Touchdown', FG: 'Field goal', SF: 'Safety', S: 'Safety', XP: 'Extra point', '2PT': 'Two-point conversion' } as Record<string, string>,

  /** Team stats compared during and after the game. */
  stats: {
    totalYards: 'Total yards',
    netPassingYards: 'Passing',
    rushingYards: 'Rushing',
    firstDowns: 'First downs',
    thirdDownEff: '3rd down conversions',
    redZoneAttempts: 'Red zone (TDs / trips)',
    turnovers: 'Turnovers',
    sacksYardsLost: 'Sacks taken',
    totalPenaltiesYards: 'Penalties',
    possessionTime: 'Time of possession'
  },
  /** "8 (65 yds)": number of penalties and yards lost. */
  penalties: (count: string, yards: string) => `${count} (${yards} yds)`,
  /** "32:15" stays "32:15" */
  possession: (clock: string) => clock,

  /** Game leaders, by category. */
  leaderCategories: { passingYards: 'Passing', rushingYards: 'Rushing', receivingYards: 'Receiving' },
  /** "18/25, 245 YDS" → "18/25, 245 yds"; "12 CAR" → "12 carries"; "6 REC" → "6 rec" */
  leaderLine: (line: string) =>
    line
      .replace(/(\d+) YDS/g, '$1 yds')
      .replace(/(\d+) CAR\b/g, '$1 carries')
      .replace(/(\d+) REC\b/g, '$1 rec'),

  /** Divisions: "AFC East" stays "AFC East". */
  directions: { East: 'East', North: 'North', South: 'South', West: 'West' } as Record<string, string>,
  /** Current streak: "W3". */
  streak: (kind: 'W' | 'L' | 'T', n: string) => `${kind}${n}`
} satisfies Messages['espn'];
