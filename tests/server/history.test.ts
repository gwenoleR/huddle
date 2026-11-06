import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

// Comme en prod après l'import : toute la saison compte, dès la semaine 1.
// (Lu au chargement de config.ts : à poser avant d'importer le serveur.)
process.env.START_WEEK = '1';
const { importHistory, parseHistory } = await import('../../server/history');
const { standings } = await import('../../server/scoring');
const { DAY, NOW, addGame, db, getMetaValue, pid, resetDb } = await import('./helpers');
const { setStartPoints } = await import('../../server/db');

beforeEach(() => {
  resetDb();
  db.exec("DELETE FROM players WHERE name NOT IN ('Gwen', 'Audrey', 'Bea', 'Bud', 'Max')");
  // Les joueurs ont leurs points repris de l'ancien site, comme en prod avant l'import.
  for (const [name, pts] of Object.entries({ Gwen: 73, Audrey: 72, Bea: 71, Bud: 69, Max: 64 }))
    setStartPoints(pid(name), pts);
});

const CSV = `,Home,Away,Prono BE,Prono AU,Prono MA,Prono GW,Prono BU
Week1,KC Chiefs,BUF Bills,KC Chiefs,BUF Bills,,KC Chiefs,KC Chiefs
,DAL Cowboys ,SF 49ers,SF 49ers,SF 49ers,DAL Cowboys,DAL Cowboys,"SF 49ers"
week2,PHI Eagles,DET Lions,PHI Eagles,PHI Eagles,PHI Eagles,DET Lions,PHI Eagles`;

/** Les trois matchs du CSV ci-dessus, terminés. */
function games() {
  return {
    g1: addGame({ id: 'g1', week: 1, away: 'BUF', home: 'KC', kickoff: NOW - 60 * DAY, score: [20, 27] }),
    g2: addGame({ id: 'g2', week: 1, away: 'SF', home: 'DAL', kickoff: NOW - 59 * DAY, score: [31, 10] }),
    g3: addGame({ id: 'g3', week: 2, away: 'DET', home: 'PHI', kickoff: NOW - 53 * DAY, score: [24, 21] })
  };
}
const pickOf = (name: string, game: string) =>
  (db.prepare('SELECT side FROM picks WHERE player_id = ? AND game_id = ?').get(pid(name), game) as { side: string } | undefined)?.side ?? null;

describe('lecture du fichier', () => {
  it('semaines, équipes (espaces en trop retirés), pronos vides et guillemets', () => {
    const lines = parseHistory(CSV);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ week: 1, home: 'KC Chiefs', away: 'BUF Bills', picks: { BE: 'KC Chiefs', AU: 'BUF Bills', GW: 'KC Chiefs', BU: 'KC Chiefs' } });
    expect(lines[1]).toMatchObject({ week: 1, home: 'DAL Cowboys', picks: { BU: 'SF 49ers' } });
    expect(lines[2].week).toBe(2); // « week2 » en minuscules
  });

  it('refuse une semaine illisible', () => {
    expect(() => parseHistory(',Home,Away,Prono GW\nSemaine 1,KC Chiefs,BUF Bills,KC Chiefs')).toThrow('semaine illisible');
  });
});

describe('import', () => {
  it('ajoute les pronos du bon côté et passe les points de départ à 0', () => {
    const { g1, g2, g3 } = games();
    const r = importHistory(parseHistory(CSV));
    expect(r).toEqual({ games: 3, picks: 14, players: ['Bea', 'Audrey', 'Gwen', 'Bud', 'Max'] });
    expect([pickOf('Bea', g1), pickOf('Audrey', g1), pickOf('Max', g1)]).toEqual(['home', 'away', null]);
    expect(pickOf('Max', g2)).toBe('home');
    expect(pickOf('Gwen', g3)).toBe('away');
    expect((db.prepare('SELECT SUM(start_points) AS s FROM player_seasons').get() as { s: number }).s).toBe(0);
  });

  it('le classement vient alors des pronos', () => {
    games();
    importHistory(parseHistory(CSV));
    const pts = Object.fromEntries(standings().map((r) => [r.name, r.points]));
    // g1 : KC gagne ; g2 : SF gagne ; g3 : DET gagne.
    expect(pts).toEqual({ Bea: 2, Bud: 2, Gwen: 2, Audrey: 1, Max: 0 });
  });

  it('heure des pronos inconnue : la veille du match (pas de faux « Sur le fil »)', () => {
    const { g1 } = games();
    importHistory(parseHistory(CSV));
    const at = (db.prepare("SELECT updated_at FROM picks WHERE game_id = 'g1' LIMIT 1").get() as { updated_at: number }).updated_at;
    const kickoff = (db.prepare("SELECT kickoff FROM games WHERE id = ?").get(g1) as { kickoff: number }).kickoff;
    expect(kickoff - at).toBe(DAY);
  });

  it('un joueur absent du fichier garde ses points de départ', () => {
    db.prepare("INSERT INTO players (name, created_at) VALUES ('Zoé', 0)").run();
    setStartPoints(pid('Zoé'), 40);
    games();
    importHistory(parseHistory(CSV));
    expect(standings().find((r) => r.name === 'Zoé')!.points).toBe(40);
  });

  it('tout ou rien : la moindre erreur n’écrit rien, et toutes les erreurs sont listées', () => {
    games();
    const bad = `${CSV}\n,NYJ Jets,MIA Dolphins,NYJ Jets,,,,\n,KC Chiefs,BUF Bills,KC Chiefs,,,,\n,PHI Eagles,DET Lions,,,,BAL Ravens,`
      .replace('Prono BU', 'Prono ZZ');
    let message = '';
    try {
      importHistory(parseHistory(bad));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('équipe inconnue'); // NYJ n'est pas dans les équipes de test
    expect(message).toContain('joueur « ZZ » inconnu');
    expect(message).toContain('« BAL Ravens » ne joue pas ce match');
    expect(message).toContain('match en double');
    expect((db.prepare('SELECT COUNT(*) AS n FROM picks').get() as { n: number }).n).toBe(0);
    expect(standings().find((r) => r.name === 'Gwen')!.points).toBe(73);
  });

  it('match pas encore en base : rien n’est importé', () => {
    addGame({ id: 'g1', week: 1, away: 'BUF', home: 'KC', score: [20, 27] });
    expect(() => importHistory(parseHistory(CSV))).toThrow('match introuvable');
  });
});

describe('import à blanc', () => {
  it('vérifie et compte sans rien écrire', () => {
    games();
    expect(importHistory(parseHistory(CSV), { dryRun: true })).toEqual({ games: 3, picks: 14, players: ['Bea', 'Audrey', 'Gwen', 'Bud', 'Max'] });
    expect((db.prepare('SELECT COUNT(*) AS n FROM picks').get() as { n: number }).n).toBe(0);
    expect(standings().find((r) => r.name === 'Gwen')!.points).toBe(73);
    expect(getMetaValue('history_import:2026')).toBeUndefined();
  });

  it('les erreurs sortent aussi à blanc', () => {
    expect(() => importHistory(parseHistory(CSV), { dryRun: true })).toThrow('match introuvable');
  });

  it('fichier vide', () => {
    expect(() => parseHistory(',Home,Away,Prono GW\n')).toThrow('Fichier vide');
  });
});

describe('import réel', () => {
  it('note la date de l’import', () => {
    games();
    importHistory(parseHistory(CSV));
    expect(JSON.parse(getMetaValue('history_import:2026')!)).toMatchObject({ games: 3, picks: 14 });
  });
});

describe('le vrai fichier de l’ancien site', () => {
  it('semaine 8 sur les vrais résultats ESPN : on retrouve les bons pronos de chacun', () => {
    // Équipes et résultats de la semaine 8 enregistrés chez ESPN (tests/fixtures/espn).
    db.exec('DELETE FROM teams');
    const teams = JSON.parse(readFileSync('tests/fixtures/espn/teams.json', 'utf8')).sports[0].leagues[0].teams;
    for (const { team: t } of teams)
      db.prepare('INSERT INTO teams (id, abbr, name, display_name) VALUES (?, ?, ?, ?)').run(t.id, t.abbreviation, t.name, t.displayName);
    const events = JSON.parse(readFileSync('tests/fixtures/espn/scoreboard-final.json', 'utf8')).events;
    for (const e of events) {
      const c = e.competitions[0].competitors;
      const away = c.find((x: { homeAway: string }) => x.homeAway === 'away');
      const home = c.find((x: { homeAway: string }) => x.homeAway === 'home');
      db.prepare(
        `INSERT INTO games (id, season, week, kickoff, status, away_id, home_id, away_score, home_score, winner, updated_at)
         VALUES (?, 2026, 8, ?, 'final', ?, ?, ?, ?, ?, 0)`
      ).run(e.id, Date.parse(e.date), away.team.id, home.team.id, Number(away.score), Number(home.score), away.winner ? 'away' : 'home');
    }
    const week8 = parseHistory(readFileSync('tests/fixtures/pronos-2026.csv', 'utf8')).filter((l) => l.week === 8);
    expect(week8).toHaveLength(14);
    importHistory(week8);
    const good = Object.fromEntries(standings(8).map((r) => [r.name, r.good]));
    expect(good).toEqual({ Bea: 10, Audrey: 10, Max: 7, Gwen: 8, Bud: 11 });
  });

  it('le fichier entier se lit : 8 semaines, 121 matchs, 2 pronos manquants (Audrey)', () => {
    const lines = parseHistory(readFileSync('tests/fixtures/pronos-2026.csv', 'utf8'));
    expect(new Set(lines.map((l) => l.week))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(lines).toHaveLength(121);
    expect(lines.filter((l) => !l.picks.AU).map((l) => l.week)).toEqual([5, 6]);
  });
});

describe('initiales', () => {
  it('sans accents ni casse', async () => {
    const { initials } = await import('../../server/history');
    expect([initials('Léa'), initials('élodie'), initials('gw')]).toEqual(['LE', 'EL', 'GW']);
  });
});

describe('messages d’erreur', () => {
  it('un joueur inconnu est signalé une seule fois, pas à chaque match', () => {
    games();
    let message = '';
    try {
      importHistory(parseHistory(CSV.replace('Prono BU', 'Prono ZZ')));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message.match(/« ZZ »/g)).toHaveLength(1);
  });

  it('deux joueurs avec les mêmes initiales : on dit lesquels', () => {
    db.prepare("INSERT INTO players (name, created_at) VALUES ('Benoît', 0)").run();
    games();
    expect(() => importHistory(parseHistory(CSV))).toThrow('« BE » ambigu : Bea, Benoît');
  });
});
