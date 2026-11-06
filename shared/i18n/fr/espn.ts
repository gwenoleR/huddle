/**
 * Textes tirés des données ESPN (en anglais) : statut d'un match, blessures, actions de jeu, stats,
 * classement. Chaque fonction reçoit la donnée brute d'ESPN et rend la phrase dans la langue.
 */

const yards = (n: unknown) => {
  const v = Math.abs(Number(n) || 0);
  return `${v} yard${v > 1 ? 's' : ''}`;
};

/** Quart-temps : « Q3 », prolongation « Prol. ». */
const quarter = (period: number) => (period > 4 ? 'Prol.' : `Q${period}`);

export const espn = {
  /** Ligne d'état sous le score, enregistrée avec le match. */
  detail: {
    final: (overtime: boolean) => (overtime ? 'Terminé · prol.' : 'Terminé'),
    postponed: 'Reporté',
    halftime: 'Mi-temps',
    endOfPeriod: (period: number) => `Fin ${quarter(period)}`,
    running: (period: number, clock: string | null) => (clock ? `${quarter(period)} · ${clock}` : quarter(period)),
    /** Le match est-il dans son dernier quart-temps ou en prolongation ? (lit les textes ci-dessus) */
    isLate: (detail: string | null) => /^(Q4|Fin Q4|Prol)/.test(detail ?? '')
  },

  /** Partie du corps d'une blessure (le texte ESPN tel quel s'il est inconnu). */
  bodyParts: {
    knee: 'genou', ankle: 'cheville', hamstring: 'ischios', concussion: 'commotion', shoulder: 'épaule', groin: 'aine',
    calf: 'mollet', back: 'dos', foot: 'pied', hip: 'hanche', quadriceps: 'quadriceps', ribs: 'côtes', thumb: 'pouce',
    hand: 'main', wrist: 'poignet', elbow: 'coude', neck: 'cou', chest: 'poitrine', illness: 'malade', toe: 'orteil',
    achilles: 'tendon d’Achille', pectoral: 'pectoral', abdomen: 'abdomen', oblique: 'oblique', 'lower leg': 'jambe',
    'lower back': 'bas du dos', heel: 'talon', finger: 'doigt', head: 'tête', face: 'visage', eye: 'œil', arm: 'bras',
    forearm: 'avant-bras', biceps: 'biceps', triceps: 'triceps', thigh: 'cuisse', shin: 'tibia', personal: 'raisons perso',
    rest: 'repos', 'not injury related': 'hors blessure', jaw: 'mâchoire', nose: 'nez', glute: 'fessier', leg: 'jambe'
  } as Record<string, string>,

  /** Forme récente : résultat d'un match (W/L/T chez ESPN). */
  result: (r: 'W' | 'L' | 'T') => (r === 'W' ? 'V' : r === 'L' ? 'D' : 'N'),

  /** Bookmaker quand ESPN n'en nomme pas. */
  defaultProvider: 'Bookmakers',

  /** « 3rd & 7 at GB 35 » → « 3e et 7 · GB 35 » */
  down: (text: string) =>
    text
      .replace(/^1st/, '1re')
      .replace(/^(\d)(nd|rd|th)/, '$1e')
      .replace('& Goal', 'et but')
      .replace('&', 'et')
      .replace(' at ', ' · '),

  /** Dernière action, d'après son type ESPN (le type tel quel s'il est inconnu). */
  play: (type: string, yardage: number): string | null => {
    switch (type) {
      case 'Rush':
        return yardage < 0 ? `Course, perte de ${yards(yardage)}` : `Course de ${yards(yardage)}`;
      case 'Pass Reception':
        return `Passe complétée, ${yards(yardage)}`;
      case 'Pass Incompletion':
        return 'Passe incomplète';
      case 'Sack':
        return `Sack, perte de ${yards(yardage)}`;
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
  },

  /** « Tucker Kraft 12 Yd pass from Jordan Love (Trey Smack Kick) » → « Passe de Jordan Love pour Tucker Kraft, 12 yards ». */
  scoringPlay: (text: string) => {
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
  },

  /** Type de point marqué (abréviation ESPN). */
  scoreKinds: { TD: 'Touchdown', FG: 'Field goal', SF: 'Safety', S: 'Safety', XP: 'Transformation', '2PT': '2 points' } as Record<string, string>,

  /** Stats d'équipe comparées pendant et après le match. */
  stats: {
    totalYards: 'Yards gagnés',
    netPassingYards: 'À la passe',
    rushingYards: 'À la course',
    firstDowns: 'Premiers downs',
    thirdDownEff: 'Conversions en 3e tentative',
    redZoneAttempts: 'Zone rouge (TD / visites)',
    turnovers: 'Ballons perdus',
    sacksYardsLost: 'Sacks subis',
    totalPenaltiesYards: 'Pénalités',
    possessionTime: 'Possession'
  },
  /** « 8 (65 yds) » : nombre de pénalités et yards perdus. */
  penalties: (count: string, yards: string) => `${count} (${yards} yds)`,
  /** « 32:15 » → « 32 min 15 » */
  possession: (clock: string) => clock.replace(':', ' min '),

  /** Meilleurs joueurs du match, par catégorie. */
  leaderCategories: { passingYards: 'À la passe', rushingYards: 'À la course', receivingYards: 'À la réception' },
  /** « 18/25, 245 YDS » → « 18/25, 245 yds » ; « 12 CAR » → « 12 courses » ; « 6 REC » → « 6 réc. » */
  leaderLine: (line: string) =>
    line
      .replace(/(\d+) YDS/g, '$1 yds')
      .replace(/(\d+) CAR\b/g, '$1 courses')
      .replace(/(\d+) REC\b/g, '$1 réc.'),

  /** Divisions : « AFC East » → « AFC Est ». */
  directions: { East: 'Est', North: 'Nord', South: 'Sud', West: 'Ouest' } as Record<string, string>,
  /** Série en cours : « W3 » → « 3 V ». */
  streak: (kind: 'W' | 'L' | 'T', n: string) => `${n} ${kind === 'W' ? 'V' : kind === 'L' ? 'D' : 'N'}`
};
