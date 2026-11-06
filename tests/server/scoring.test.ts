import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { awards, latestRecapWeek, liveProjection, pointsFor, recap, standings, streak, weeklyResults } from '../../server/scoring';
import { saveBonusPick, saveBonusSettings } from '../../server/bonus';
import { DAY, NOW, TEAMS, addGame, db, pick, picks, pid, resetDb, setMeta } from './helpers';

beforeEach(() => {
  resetDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const row = (name: string, week?: number) => standings(week).find((r) => r.name === name)!;
const award = (id: string) => awards().find((a) => a.id === id)!;

describe('scoring', () => {
  it('1 point in the regular season, 2 in the playoffs', () => {
    expect(pointsFor(9)).toBe(1);
    expect(pointsFor(18)).toBe(1);
    expect(pointsFor(19)).toBe(2);
    expect(pointsFor(22)).toBe(2);
  });

  it('standings follow the scoring, week by week', () => {
    for (let week = 9; week <= 22; week++) {
      resetDb();
      picks(addGame({ week, score: [1, 0] }), { Max: 'away' });
      expect(row('Max').points - 64).toBe(pointsFor(week));
    }
  });
});

describe('season standings', () => {
  it('without games, everyone keeps their starting points, in order', () => {
    expect(standings().map((r) => [r.name, r.points, r.rank])).toEqual([
      ['Gwen', 73, 1],
      ['Audrey', 72, 2],
      ['Bea', 71, 3],
      ['Bud', 69, 4],
      ['Max', 64, 5]
    ]);
  });

  it('adds 1 point per correct pick on a final game', () => {
    const g = addGame({ week: 10, score: [24, 17] });
    picks(g, { Gwen: 'away', Audrey: 'home' });
    expect(row('Gwen')).toMatchObject({ points: 74, good: 1, played: 1 });
    expect(row('Audrey')).toMatchObject({ points: 72, good: 0, played: 1 });
  });

  it('counts double in the playoffs', () => {
    picks(addGame({ week: 19, score: [10, 31] }), { Max: 'home' });
    expect(row('Max').points).toBe(66);
  });

  it('ignores games not yet final', () => {
    picks(addGame({ week: 10, status: 'live', score: [14, 0] }), { Gwen: 'away' });
    picks(addGame({ week: 10, kickoff: NOW + DAY }), { Gwen: 'away' });
    expect(row('Gwen')).toMatchObject({ points: 73, played: 0 });
  });

  it('ignores weeks before the start week (already in the starting points)', () => {
    picks(addGame({ week: 8, score: [24, 17] }), { Gwen: 'away' });
    expect(row('Gwen').points).toBe(73);
  });

  it('a tie game scores nothing', () => {
    picks(addGame({ week: 10, score: [20, 20] }), { Gwen: 'away', Audrey: 'home' });
    expect(row('Gwen').points).toBe(73);
    expect(row('Audrey').points).toBe(72);
  });

  it('shares ranks on ties (1, 2, 2, 4) and breaks ties by name', () => {
    picks(addGame({ week: 10, score: [24, 17] }), { Audrey: 'away' }); // Audrey 73 = Gwen 73
    const r = standings();
    expect(r.slice(0, 3).map((x) => [x.name, x.rank])).toEqual([
      ['Audrey', 1],
      ['Gwen', 1],
      ['Bea', 3]
    ]);
  });

  it('weekly standings: only that week\'s points, without starting points', () => {
    picks(addGame({ week: 10, score: [24, 17] }), { Max: 'away' });
    picks(addGame({ week: 11, score: [24, 17] }), { Gwen: 'away' });
    expect(row('Max', 10)).toMatchObject({ points: 1, rank: 1 });
    expect(row('Gwen', 10)).toMatchObject({ points: 0, rank: 2 });
  });
});

describe('profile', () => {
  it('current streak: consecutive correct picks from the most recent', () => {
    const g1 = addGame({ week: 10, kickoff: NOW - 5 * DAY, score: [10, 20] });
    const g2 = addGame({ week: 10, kickoff: NOW - 4 * DAY, score: [30, 20] });
    const g3 = addGame({ week: 10, kickoff: NOW - 3 * DAY, score: [30, 20] });
    pick('Bea', g1, 'away'); // missed
    pick('Bea', g2, 'away');
    pick('Bea', g3, 'away');
    expect(streak(pid('Bea'))).toBe(2);
  });

  it('results per week, from most recent to oldest', () => {
    picks(addGame({ week: 10, score: [30, 20] }), { Bea: 'away' });
    addGame({ week: 10, score: [30, 20] }); // no pick
    picks(addGame({ week: 11, score: [30, 20] }), { Bea: 'home' });
    expect(weeklyResults(pid('Bea'))).toEqual([
      { week: 11, label: 'S11', good: 0, finals: 1 },
      { week: 10, label: 'S10', good: 1, finals: 2 }
    ]);
  });
});

describe('live standings', () => {
  it('nothing to project without a live game', () => {
    addGame({ week: 10, score: [3, 0] });
    expect(liveProjection()).toBeNull();
  });

  it('adds the leading team\'s points, and counts winners and losers', () => {
    const g = addGame({ week: 10, status: 'live', score: [7, 3] });
    picks(g, { Max: 'away', Gwen: 'home' });
    const live = liveProjection()!;
    expect(live.games).toBe(1);
    const m = live.rows.find((r) => r.name === 'Max')!;
    expect(m).toMatchObject({ points: 64, projected: 65, winning: 1, losing: 0 });
    expect(live.rows.find((r) => r.name === 'Gwen')).toMatchObject({ projected: 73, winning: 0, losing: 1 });
  });

  it('a live tie scores nothing for anyone', () => {
    picks(addGame({ week: 10, status: 'live', score: [7, 7] }), { Max: 'away', Gwen: 'home' });
    const live = liveProjection()!;
    expect(live.rows.every((r) => r.projected === r.points && r.winning === 0 && r.losing === 0)).toBe(true);
  });

  it('projected ranks follow projected points', () => {
    picks(addGame({ week: 19, status: 'live', score: [21, 0] }), { Audrey: 'away', Bea: 'away' });
    const rows = liveProjection()!.rows;
    expect(rows.slice(0, 3).map((r) => [r.name, r.projected, r.projectedRank])).toEqual([
      ['Audrey', 74, 1],
      ['Bea', 73, 2],
      ['Gwen', 73, 2]
    ]);
  });
});

describe('weekly recap', () => {
  it('finds the latest week with a final game', () => {
    expect(latestRecapWeek()).toBeNull();
    addGame({ week: 10, score: [1, 0] });
    addGame({ week: 11, kickoff: NOW + DAY });
    expect(latestRecapWeek()).toBe(10);
  });

  it('the blunder is the game most people got wrong', () => {
    const g1 = addGame({ week: 10, away: 'BUF', home: 'KC', score: [24, 17] });
    const g2 = addGame({ week: 10, away: 'SF', home: 'DAL', score: [10, 27] });
    addGame({ week: 10, kickoff: NOW + DAY });
    picks(g1, { Gwen: 'home', Audrey: 'away' });
    picks(g2, { Gwen: 'away', Audrey: 'away', Bea: 'away' });
    const r = recap(10);
    expect(r).toMatchObject({ week: 10, complete: false, finals: 2, total: 3 });
    expect(r.blunder).toMatchObject({ away: '49ers', home: 'Cowboys', wrongTeam: '49ers', wrong: ['Gwen', 'Audrey', 'Bea'], total: 3 });
  });

  it('gives the season total next to the week\'s points', () => {
    picks(addGame({ week: 10, score: [24, 17] }), { Max: 'away' });
    const m = recap(10).rows.find((r) => r.name === 'Max')!;
    expect(m).toMatchObject({ points: 1, seasonPoints: 65, seasonRank: 5 });
  });
});

describe('awards', () => {
  it('nobody wins anything without games', () => {
    expect(awards().every((a) => a.who === null)).toBe(true);
  });

  it('best week: with equal correct picks, the week with fewer games wins', () => {
    for (let i = 0; i < 2; i++) picks(addGame({ week: 10, score: [1, 0] }), { Gwen: 'away' });
    addGame({ week: 10, score: [1, 0] }); // Gwen: 2 of 3
    for (let i = 0; i < 2; i++) picks(addGame({ week: 11, score: [1, 0] }), { Bea: 'away' }); // Bea: 2 of 2
    expect(award('best-week')).toMatchObject({ who: 'Bea', detail: '2 sur 2 en semaine 11' });
  });

  it('sniper: needs at least 10 games', () => {
    for (let i = 0; i < 9; i++) picks(addGame({ week: 10, score: [1, 0] }), { Gwen: 'away' });
    expect(award('sniper').who).toBeNull();
    picks(addGame({ week: 10, score: [0, 1] }), { Gwen: 'away' });
    expect(award('sniper')).toMatchObject({ who: 'Gwen', detail: '90 % de réussite (9 sur 10)' });
  });

  it('unstoppable: at least 5 correct in a row', () => {
    const run = (n: number) => {
      for (let i = 0; i < n; i++) picks(addGame({ week: 10, kickoff: NOW - (20 - i) * DAY, score: [1, 0] }), { Bud: 'away' });
    };
    run(4);
    expect(award('streak').who).toBeNull();
    run(1);
    expect(award('streak')).toMatchObject({ who: 'Bud', detail: '5 bons pronos d’affilée' });
  });

  it('contrarian: picks against the majority, except evenly split games', () => {
    picks(addGame({ week: 10, score: [1, 0] }), { Gwen: 'away', Audrey: 'away', Max: 'home' });
    picks(addGame({ week: 10, score: [1, 0] }), { Gwen: 'away', Max: 'home' }); // split evenly: doesn't count
    expect(award('contrarian')).toMatchObject({ who: 'Max', detail: '1 prono contre la majorité' });
  });

  it('heart and black cat: from 3 times the same team', () => {
    for (let i = 0; i < 3; i++) picks(addGame({ week: 10, away: 'DAL', home: 'PHI', score: [0, 7] }), { Bea: 'away' });
    expect(award('heart')).toMatchObject({ who: 'Bea', detail: 'les Cowboys, 3 fois' });
    expect(award('black-cat')).toMatchObject({ who: 'Bea', detail: 'les Cowboys l’ont trahi 3 fois' });
  });

  it('last minute: picks made in the final quarter hour', () => {
    for (let i = 0; i < 3; i++) {
      const k = NOW - (i + 1) * DAY;
      const g = addGame({ week: 10, kickoff: k, score: [1, 0] });
      pick('Audrey', g, 'away', k - 5 * 60_000);
      pick('Gwen', g, 'away', k - 60 * 60_000);
    }
    expect(award('last-minute')).toMatchObject({ who: 'Audrey', detail: '3 pronos dans le dernier quart d’heure' });
  });

  it('Nostradamus: the right Super Bowl winner, closest to the total', () => {
    setMeta('bonus_result:2026', JSON.stringify({ afc: TEAMS.BUF.id, nfc: TEAMS.SF.id, sb: TEAMS.BUF.id, sbTotal: 47 }));
    saveBonusPick({ playerId: pid('Audrey'), afc: TEAMS.BUF.id, nfc: TEAMS.SF.id, sb: TEAMS.BUF.id, sbTotal: 50 });
    saveBonusPick({ playerId: pid('Bud'), afc: TEAMS.BUF.id, nfc: TEAMS.SF.id, sb: TEAMS.BUF.id, sbTotal: 46 });
    saveBonusPick({ playerId: pid('Bea'), afc: TEAMS.KC.id, nfc: TEAMS.SF.id, sb: TEAMS.SF.id, sbTotal: 47 });
    expect(award('nostradamus')).toMatchObject({ who: 'Bud' });
    expect(award('nostradamus').detail).toContain('écart 1');
  });

  it('no Nostradamus when the bonus is disabled', () => {
    saveBonusSettings({ enabled: false, points: { afc: 3, nfc: 3, sb: 5 }, reveal: 'wildcard' });
    expect(awards().map((a) => a.id)).not.toContain('nostradamus');
  });
});

it('the test database is in memory', () => {
  expect((db.prepare('PRAGMA database_list').get() as { file: string }).file).toBe('');
});
