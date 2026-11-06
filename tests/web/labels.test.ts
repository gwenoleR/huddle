import { describe, expect, it } from 'vitest';
import { dayLabel, kickoffLabel, ordinal } from '../../web/src/lib/format';
import { t } from '../../web/src/lib/i18n';
import { detailLabel, espnLine, pointsOrigin, seasonRecord, standingText, withByes } from '../../web/src/lib/labels';
import { parseHash } from '../../web/src/lib/router';

describe('dates in Paris time', () => {
  it('kickoff: day and time', () => {
    expect(kickoffLabel(Date.parse('2026-11-08T18:00:00Z'))).toBe('dim. 19:00');
    expect(kickoffLabel(Date.parse('2026-11-10T01:15:00Z'))).toBe('mar. 02:15'); // Monday Night in France
  });

  it('day', () => {
    expect(dayLabel(Date.parse('2026-11-08T18:00:00Z'))).toBe('dim. 8 nov.');
  });

  it('summer time in September', () => {
    expect(kickoffLabel(Date.parse('2026-09-13T17:00:00Z'))).toBe('dim. 19:00');
  });
});

describe('small words', () => {
  it('ordinals and plurals', () => {
    expect([ordinal(1), ordinal(2), ordinal(11)]).toEqual(['1er', '2e', '11e']);
    expect([t.common.pronos(0), t.common.pronos(1), t.common.pronos(2)]).toEqual(['0 prono', '1 prono', '2 pronos']);
  });
});

describe('NFL standings position', () => {
  const st = (o: object) => ({ conference: 'AFC', division: 'AFC Est', divRank: 1, seed: 1, clinch: null, ...o }) as never;

  it('seed, out of the playoffs, eliminated', () => {
    expect(standingText(null)).toBe('–');
    expect(standingText(st({}))).toBe('1er AFC Est · 1re tête de série');
    expect(standingText(st({ divRank: 2, seed: 6 }))).toBe('2e AFC Est · 6e tête de série');
    expect(standingText(st({ divRank: 3, seed: 11 }))).toBe('3e AFC Est · hors playoffs (11e)');
    expect(standingText(st({ divRank: 4, seed: 15, clinch: 'out' }))).toBe('4e AFC Est · éliminé');
    expect(standingText(st({ seed: null }))).toBe('1er AFC Est');
  });
});

describe('link to the game page', () => {
  it('depends on the game state and on picks', () => {
    expect(detailLabel('scheduled', true)).toBe('Favori, forme, blessés et pronos');
    expect(detailLabel('scheduled', false)).toBe('Favori, forme et blessés');
    expect(detailLabel('live', true)).toBe('Suivre le match et pronos');
    expect(detailLabel('final', false)).toBe('Stats du match');
  });
});

describe('team schedule', () => {
  const g = (week: number) => ({ week, id: `w${week}` }) as never;

  it('inserts the bye week in the right place', () => {
    const out = withByes([g(1), g(2), g(4), g(5)]);
    expect(out.map((x: any) => ('bye' in x ? `bye ${x.week}` : x.week))).toEqual([1, 2, 'bye 3', 4, 5]);
  });

  it('does not count the playoffs as bye weeks', () => {
    const out = withByes([g(17), g(18), g(19), g(21)]);
    expect(out.filter((x: any) => 'bye' in x).map((x) => x.week)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});

describe('app routes', () => {
  it.each([
    ['', { name: 'matches' }],
    ['#/matches/12', { name: 'matches', week: 12 }],
    ['#/match/401873023', { name: 'match', id: '401873023' }],
    ['#/match', { name: 'matches' }],
    ['#/standings', { name: 'standings', nfl: false }],
    ['#/standings/nfl', { name: 'standings', nfl: true }],
    ['#/bonus', { name: 'bonus' }],
    ['#/recap/10', { name: 'recap', week: 10 }],
    ['#/admin', { name: 'admin' }],
    ['#/season', { name: 'season' }],
    ['#/season/2025', { name: 'season', season: 2025 }],
    ['#/unknown', { name: 'matches' }],
    // Older French paths (notifications already sent, bookmarks)
    ['#/matchs/12', { name: 'matches', week: 12 }],
    ['#/classement/nfl', { name: 'standings', nfl: true }],
    ['#/profil', { name: 'profile' }],
    ['#/bilan/2025', { name: 'season', season: 2025 }]
  ])('%s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });
});

describe('ESPN line on the admin screen', () => {
  it('calls, errors and pause', () => {
    expect(espnLine({ lastHour: 1, lastDay: 40, errorsLastHour: 0, pausedUntil: null })).toBe('1 appel ESPN sur la dernière heure · 40 sur 24 h');
    expect(espnLine({ lastHour: 12, lastDay: 40, errorsLastHour: 2, pausedUntil: null })).toBe(
      '12 appels ESPN sur la dernière heure · 2 en erreur · 40 sur 24 h'
    );
    expect(espnLine({ lastHour: 12, lastDay: 40, errorsLastHour: 1, pausedUntil: Date.parse('2026-11-08T18:40:00Z') })).toBe(
      'ESPN demande de ralentir : appels en pause jusqu’à 19:40'
    );
  });
});

describe('line under the name in the leaderboard', () => {
  const r = (o: object) => ({ good: 0, played: 0, startPoints: 0, bonus: 0, points: 0, ...o });

  it('full season in the app', () => {
    expect(seasonRecord(r({ good: 81, played: 135 }), 1)).toBe('81 / 135');
    expect(seasonRecord(r({ good: 81, played: 135, bonus: 8 }), 1)).toBe('81 / 135 · +8 bonus');
    expect(seasonRecord(r({}), 1)).toBe('Pas encore de match terminé');
  });

  it('with a mid-season start', () => {
    expect(seasonRecord(r({ good: 5, played: 8, startPoints: 73 }), 9)).toBe('5 / 8 depuis la S9 · 73 repris');
    expect(seasonRecord(r({ startPoints: 73 }), 9)).toBe('73 pts repris de l’ancien site');
  });

  it('season summary: where the points come from', () => {
    expect(pointsOrigin(r({ good: 81, points: 81 }))).toBe('81 bons pronos');
    expect(pointsOrigin(r({ good: 1, points: 1 }))).toBe('1 bon prono');
    expect(pointsOrigin(r({ good: 81, bonus: 8, points: 89 }))).toBe('81 bons pronos + 8 de bonus');
    expect(pointsOrigin(r({ good: 5, startPoints: 40, points: 45 }))).toBe('40 repris + 5 dans l’appli');
  });
});
