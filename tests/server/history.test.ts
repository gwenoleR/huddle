import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

// As in prod after the import: the whole season counts, from week 1.
// (Read when config.ts loads: must be set before importing the server.)
process.env.START_WEEK = '1';
const { importHistory, parseHistory } = await import('../../server/history');
const { standings } = await import('../../server/scoring');
const { DAY, NOW, addGame, db, getMetaValue, pid, resetDb } = await import('./helpers');
const { setStartPoints } = await import('../../server/db');

beforeEach(() => {
  resetDb();
  db.exec("DELETE FROM players WHERE name NOT IN ('Gwen', 'Audrey', 'Bea', 'Bud', 'Max')");
  // Players have their points carried over from the old site, as in prod before the import.
  for (const [name, pts] of Object.entries({ Gwen: 73, Audrey: 72, Bea: 71, Bud: 69, Max: 64 }))
    setStartPoints(pid(name), pts);
});

const CSV = `,Home,Away,Prono BE,Prono AU,Prono MA,Prono GW,Prono BU
Week1,KC Chiefs,BUF Bills,KC Chiefs,BUF Bills,,KC Chiefs,KC Chiefs
,DAL Cowboys ,SF 49ers,SF 49ers,SF 49ers,DAL Cowboys,DAL Cowboys,"SF 49ers"
week2,PHI Eagles,DET Lions,PHI Eagles,PHI Eagles,PHI Eagles,DET Lions,PHI Eagles`;

/** The three games of the CSV above, final. */
function games() {
  return {
    g1: addGame({ id: 'g1', week: 1, away: 'BUF', home: 'KC', kickoff: NOW - 60 * DAY, score: [20, 27] }),
    g2: addGame({ id: 'g2', week: 1, away: 'SF', home: 'DAL', kickoff: NOW - 59 * DAY, score: [31, 10] }),
    g3: addGame({ id: 'g3', week: 2, away: 'DET', home: 'PHI', kickoff: NOW - 53 * DAY, score: [24, 21] })
  };
}
const pickOf = (name: string, game: string) =>
  (db.prepare('SELECT side FROM picks WHERE player_id = ? AND game_id = ?').get(pid(name), game) as { side: string } | undefined)?.side ?? null;

describe('file parsing', () => {
  it('weeks, teams (extra spaces trimmed), empty picks and quotes', () => {
    const lines = parseHistory(CSV);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ week: 1, home: 'KC Chiefs', away: 'BUF Bills', picks: { BE: 'KC Chiefs', AU: 'BUF Bills', GW: 'KC Chiefs', BU: 'KC Chiefs' } });
    expect(lines[1]).toMatchObject({ week: 1, home: 'DAL Cowboys', picks: { BU: 'SF 49ers' } });
    expect(lines[2].week).toBe(2); // lowercase "week2"
  });

  it('rejects an unreadable week', () => {
    expect(() => parseHistory(',Home,Away,Prono GW\nSemaine 1,KC Chiefs,BUF Bills,KC Chiefs')).toThrow('semaine illisible');
  });
});

describe('import', () => {
  it('adds picks on the right side and sets starting points to 0', () => {
    const { g1, g2, g3 } = games();
    const r = importHistory(parseHistory(CSV));
    expect(r).toEqual({ games: 3, picks: 14, players: ['Bea', 'Audrey', 'Gwen', 'Bud', 'Max'] });
    expect([pickOf('Bea', g1), pickOf('Audrey', g1), pickOf('Max', g1)]).toEqual(['home', 'away', null]);
    expect(pickOf('Max', g2)).toBe('home');
    expect(pickOf('Gwen', g3)).toBe('away');
    expect((db.prepare('SELECT SUM(start_points) AS s FROM player_seasons').get() as { s: number }).s).toBe(0);
  });

  it('standings then come from the picks', () => {
    games();
    importHistory(parseHistory(CSV));
    const pts = Object.fromEntries(standings().map((r) => [r.name, r.points]));
    // g1: KC wins; g2: SF wins; g3: DET wins.
    expect(pts).toEqual({ Bea: 2, Bud: 2, Gwen: 2, Audrey: 1, Max: 0 });
  });

  it('unknown pick time: the day before the game (no false "last minute" award)', () => {
    const { g1 } = games();
    importHistory(parseHistory(CSV));
    const at = (db.prepare("SELECT updated_at FROM picks WHERE game_id = 'g1' LIMIT 1").get() as { updated_at: number }).updated_at;
    const kickoff = (db.prepare("SELECT kickoff FROM games WHERE id = ?").get(g1) as { kickoff: number }).kickoff;
    expect(kickoff - at).toBe(DAY);
  });

  it('a player missing from the file keeps their starting points', () => {
    db.prepare("INSERT INTO players (name, created_at) VALUES ('Zoé', 0)").run();
    setStartPoints(pid('Zoé'), 40);
    games();
    importHistory(parseHistory(CSV));
    expect(standings().find((r) => r.name === 'Zoé')!.points).toBe(40);
  });

  it('all or nothing: any error writes nothing, and all errors are listed', () => {
    games();
    const bad = `${CSV}\n,NYJ Jets,MIA Dolphins,NYJ Jets,,,,\n,KC Chiefs,BUF Bills,KC Chiefs,,,,\n,PHI Eagles,DET Lions,,,,BAL Ravens,`
      .replace('Prono BU', 'Prono ZZ');
    let message = '';
    try {
      importHistory(parseHistory(bad));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('équipe inconnue'); // NYJ is not among the test teams
    expect(message).toContain('joueur « ZZ » inconnu');
    expect(message).toContain('« BAL Ravens » ne joue pas ce match');
    expect(message).toContain('match en double');
    expect((db.prepare('SELECT COUNT(*) AS n FROM picks').get() as { n: number }).n).toBe(0);
    expect(standings().find((r) => r.name === 'Gwen')!.points).toBe(73);
  });

  it('game not yet in the database: nothing is imported', () => {
    addGame({ id: 'g1', week: 1, away: 'BUF', home: 'KC', score: [20, 27] });
    expect(() => importHistory(parseHistory(CSV))).toThrow('match introuvable');
  });
});

describe('dry-run import', () => {
  it('checks and counts without writing anything', () => {
    games();
    expect(importHistory(parseHistory(CSV), { dryRun: true })).toEqual({ games: 3, picks: 14, players: ['Bea', 'Audrey', 'Gwen', 'Bud', 'Max'] });
    expect((db.prepare('SELECT COUNT(*) AS n FROM picks').get() as { n: number }).n).toBe(0);
    expect(standings().find((r) => r.name === 'Gwen')!.points).toBe(73);
    expect(getMetaValue('history_import:2026')).toBeUndefined();
  });

  it('errors are reported in dry runs too', () => {
    expect(() => importHistory(parseHistory(CSV), { dryRun: true })).toThrow('match introuvable');
  });

  it('empty file', () => {
    expect(() => parseHistory(',Home,Away,Prono GW\n')).toThrow('Fichier vide');
  });
});

describe('real import', () => {
  it('records the import date', () => {
    games();
    importHistory(parseHistory(CSV));
    expect(JSON.parse(getMetaValue('history_import:2026')!)).toMatchObject({ games: 3, picks: 14 });
  });
});

describe('a full week against recorded ESPN data', () => {
  it('real team names, as exported by the old site: correct picks counted right', () => {
    // Week 8 teams and results recorded from ESPN (tests/fixtures/espn).
    db.exec('DELETE FROM teams');
    const teams = JSON.parse(readFileSync('tests/fixtures/espn/teams.json', 'utf8')).sports[0].leagues[0].teams;
    const fullName = new Map<string, string>();
    for (const { team: t } of teams) {
      db.prepare('INSERT INTO teams (id, abbr, name, display_name) VALUES (?, ?, ?, ?)').run(t.id, t.abbreviation, t.name, t.displayName);
      fullName.set(String(t.id), t.displayName);
    }
    const events = JSON.parse(readFileSync('tests/fixtures/espn/scoreboard-final.json', 'utf8')).events;
    const rows: string[] = [];
    for (const [i, e] of events.entries()) {
      const c = e.competitions[0].competitors;
      const away = c.find((x: { homeAway: string }) => x.homeAway === 'away');
      const home = c.find((x: { homeAway: string }) => x.homeAway === 'home');
      db.prepare(
        `INSERT INTO games (id, season, week, kickoff, status, away_id, home_id, away_score, home_score, winner, updated_at)
         VALUES (?, 2026, 8, ?, 'final', ?, ?, ?, ?, ?, 0)`
      ).run(e.id, Date.parse(e.date), away.team.id, home.team.id, Number(away.score), Number(home.score), away.winner ? 'away' : 'home');
      // Bea always picks the winner, Gwen always the home team, Max skips every other game.
      const [awayName, homeName] = [fullName.get(String(away.team.id))!, fullName.get(String(home.team.id))!];
      const winner = away.winner ? awayName : homeName;
      rows.push([i ? '' : 'Week8', homeName, awayName, winner, homeName, i % 2 ? '' : winner].join(','));
    }
    const lines = parseHistory([',Home,Away,Prono BE,Prono GW,Prono MA', ...rows].join('\n'));
    expect(lines).toHaveLength(events.length);
    importHistory(lines);
    const good = Object.fromEntries(standings(8).map((r) => [r.name, r.good]));
    const homeWins = events.filter((e: any) => e.competitions[0].competitors.find((x: any) => x.homeAway === 'home').winner).length;
    expect(good).toMatchObject({ Bea: events.length, Gwen: homeWins, Max: Math.ceil(events.length / 2) });
  });
});

describe('initials', () => {
  it('without accents or case', async () => {
    const { initials } = await import('../../server/history');
    expect([initials('Léa'), initials('élodie'), initials('gw')]).toEqual(['LE', 'EL', 'GW']);
  });
});

describe('error messages', () => {
  it('an unknown player is reported once, not for every game', () => {
    games();
    let message = '';
    try {
      importHistory(parseHistory(CSV.replace('Prono BU', 'Prono ZZ')));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message.match(/« ZZ »/g)).toHaveLength(1);
  });

  it('two players with the same initials: says which ones', () => {
    db.prepare("INSERT INTO players (name, created_at) VALUES ('Benoît', 0)").run();
    games();
    expect(() => importHistory(parseHistory(CSV))).toThrow('« BE » ambigu : Bea, Benoît');
  });
});
