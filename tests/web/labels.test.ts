import { describe, expect, it } from 'vitest';
import { dayLabel, kickoffLabel, ordinal, plural } from '../../web/src/lib/format';
import { detailLabel, espnLine, pointsOrigin, seasonRecord, standingText, withByes } from '../../web/src/lib/labels';
import { parseHash } from '../../web/src/lib/router';

describe('dates à l’heure de Paris', () => {
  it('coup d’envoi : jour et heure', () => {
    expect(kickoffLabel(Date.parse('2026-11-08T18:00:00Z'))).toBe('dim. 19:00');
    expect(kickoffLabel(Date.parse('2026-11-10T01:15:00Z'))).toBe('mar. 02:15'); // Monday Night en France
  });

  it('jour', () => {
    expect(dayLabel(Date.parse('2026-11-08T18:00:00Z'))).toBe('dim. 8 nov.');
  });

  it('heure d’été en septembre', () => {
    expect(kickoffLabel(Date.parse('2026-09-13T17:00:00Z'))).toBe('dim. 19:00');
  });
});

describe('petits mots', () => {
  it('ordinaux et pluriels', () => {
    expect([ordinal(1), ordinal(2), ordinal(11)]).toEqual(['1er', '2e', '11e']);
    expect([plural(0, 'prono'), plural(1, 'prono'), plural(2, 'prono')]).toEqual(['0 prono', '1 prono', '2 pronos']);
  });
});

describe('place au classement NFL', () => {
  const st = (o: object) => ({ conference: 'AFC', division: 'AFC Est', divRank: 1, seed: 1, clinch: null, ...o }) as never;

  it('tête de série, hors playoffs, éliminé', () => {
    expect(standingText(null)).toBe('–');
    expect(standingText(st({}))).toBe('1er AFC Est · 1re tête de série');
    expect(standingText(st({ divRank: 2, seed: 6 }))).toBe('2e AFC Est · 6e tête de série');
    expect(standingText(st({ divRank: 3, seed: 11 }))).toBe('3e AFC Est · hors playoffs (11e)');
    expect(standingText(st({ divRank: 4, seed: 15, clinch: 'out' }))).toBe('4e AFC Est · éliminé');
    expect(standingText(st({ seed: null }))).toBe('1er AFC Est');
  });
});

describe('lien vers la fiche match', () => {
  it('dépend de l’état du match et des pronos', () => {
    expect(detailLabel('scheduled', true)).toBe('Favori, forme, blessés et pronos');
    expect(detailLabel('scheduled', false)).toBe('Favori, forme et blessés');
    expect(detailLabel('live', true)).toBe('Suivre le match et pronos');
    expect(detailLabel('final', false)).toBe('Stats du match');
  });
});

describe('calendrier d’équipe', () => {
  const g = (week: number) => ({ week, id: `w${week}` }) as never;

  it('ajoute la semaine de repos au bon endroit', () => {
    const out = withByes([g(1), g(2), g(4), g(5)]);
    expect(out.map((x: any) => ('bye' in x ? `repos ${x.week}` : x.week))).toEqual([1, 2, 'repos 3', 4, 5]);
  });

  it('ne compte pas les playoffs comme des semaines de repos', () => {
    const out = withByes([g(17), g(18), g(19), g(21)]);
    expect(out.filter((x: any) => 'bye' in x).map((x) => x.week)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});

describe('routes de l’appli', () => {
  it.each([
    ['', { name: 'matchs' }],
    ['#/matchs/12', { name: 'matchs', week: 12 }],
    ['#/match/401873023', { name: 'match', id: '401873023' }],
    ['#/match', { name: 'matchs' }],
    ['#/classement', { name: 'classement', nfl: false }],
    ['#/classement/nfl', { name: 'classement', nfl: true }],
    ['#/bonus', { name: 'bonus' }],
    ['#/recap/10', { name: 'recap', week: 10 }],
    ['#/admin', { name: 'admin' }],
    ['#/bilan', { name: 'bilan' }],
    ['#/bilan/2025', { name: 'bilan', season: 2025 }],
    ['#/nimporte', { name: 'matchs' }]
  ])('%s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });
});

describe('ligne ESPN de l’écran admin', () => {
  it('appels, erreurs et pause', () => {
    expect(espnLine({ lastHour: 1, lastDay: 40, errorsLastHour: 0, pausedUntil: null })).toBe('1 appel ESPN sur la dernière heure · 40 sur 24 h');
    expect(espnLine({ lastHour: 12, lastDay: 40, errorsLastHour: 2, pausedUntil: null })).toBe(
      '12 appels ESPN sur la dernière heure · 2 en erreur · 40 sur 24 h'
    );
    expect(espnLine({ lastHour: 12, lastDay: 40, errorsLastHour: 1, pausedUntil: Date.parse('2026-11-08T18:40:00Z') })).toBe(
      'ESPN demande de ralentir : appels en pause jusqu’à 19:40'
    );
  });
});

describe('ligne sous le nom au classement', () => {
  const r = (o: object) => ({ good: 0, played: 0, startPoints: 0, bonus: 0, points: 0, ...o });

  it('saison complète dans l’appli', () => {
    expect(seasonRecord(r({ good: 81, played: 135 }), 1)).toBe('81 / 135');
    expect(seasonRecord(r({ good: 81, played: 135, bonus: 8 }), 1)).toBe('81 / 135 · +8 bonus');
    expect(seasonRecord(r({}), 1)).toBe('Pas encore de match terminé');
  });

  it('avec une reprise en cours de saison', () => {
    expect(seasonRecord(r({ good: 5, played: 8, startPoints: 73 }), 9)).toBe('5 / 8 depuis la S9 · 73 repris');
    expect(seasonRecord(r({ startPoints: 73 }), 9)).toBe('73 pts repris de l’ancien site');
  });

  it('bilan : d’où viennent les points', () => {
    expect(pointsOrigin(r({ good: 81, points: 81 }))).toBe('81 bons pronos');
    expect(pointsOrigin(r({ good: 1, points: 1 }))).toBe('1 bon prono');
    expect(pointsOrigin(r({ good: 81, bonus: 8, points: 89 }))).toBe('81 bons pronos + 8 de bonus');
    expect(pointsOrigin(r({ good: 5, startPoints: 40, points: 45 }))).toBe('40 repris + 5 dans l’appli');
  });
});
