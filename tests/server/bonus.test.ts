import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NflStandings } from '../../server/espn';

// NFL standings come from ESPN: replaced by a hand-made version.
vi.mock('../../server/espn', async (orig) => ({ ...(await orig<typeof import('../../server/espn')>()), fetchStandings: vi.fn() }));
const { fetchStandings } = await import('../../server/espn');
const bonus = await import('../../server/bonus');
const { standings } = await import('../../server/scoring');
const { DAY, HOUR, NOW, TEAMS, addGame, pid, resetDb, setMeta } = await import('./helpers');
const { setStartPoints } = await import('../../server/db');

const { BUF, KC, SF, PHI } = TEAMS;
const FIELD = {
  afc: [BUF, KC, '33', '23', '10', '11', '13'].map((t, i) => ({ teamId: typeof t === 'string' ? t : t.id, seed: i + 1 })),
  nfc: [SF, PHI, '8', '6', '14', '15', '16'].map((t, i) => ({ teamId: typeof t === 'string' ? t : t.id, seed: i + 1 }))
};
const openField = () => setMeta('bonus_field:2026', JSON.stringify(FIELD));
const settings = (s: Partial<ReturnType<typeof bonus.bonusSettings>>) => bonus.saveBonusSettings({ ...bonus.bonusSettings(), ...s });
const choose = (name: string, afc: string, nfc: string, sb: string, sbTotal: number) =>
  bonus.saveBonusPick({ playerId: pid(name), afc, nfc, sb, sbTotal });
const result = (r: Partial<ReturnType<typeof bonus.bonusResult>>) =>
  setMeta('bonus_result:2026', JSON.stringify({ afc: null, nfc: null, sb: null, sbTotal: null, ...r }));

beforeEach(() => {
  resetDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(fetchStandings).mockReset();
});
afterEach(() => vi.useRealTimers());

describe('settings', () => {
  it('defaults: enabled, 3/3/5, revealed at the Wild Card', () => {
    expect(bonus.bonusSettings()).toEqual({ enabled: true, points: { afc: 3, nfc: 3, sb: 5 }, reveal: 'wildcard' });
  });

  it('keeps what the admin saved', () => {
    settings({ enabled: false, points: { afc: 2, nfc: 2, sb: 6 }, reveal: 'superbowl' });
    expect(bonus.bonusSettings()).toEqual({ enabled: false, points: { afc: 2, nfc: 2, sb: 6 }, reveal: 'superbowl' });
  });

  it('falls back to defaults if the settings are unreadable', () => {
    setMeta('bonus_settings', '{not json');
    expect(bonus.bonusSettings().points).toEqual({ afc: 3, nfc: 3, sb: 5 });
    setMeta('bonus_settings', JSON.stringify({ enabled: true, reveal: 'whatever' }));
    expect(bonus.bonusSettings()).toMatchObject({ reveal: 'wildcard', points: { afc: 3, nfc: 3, sb: 5 } });
  });
});

describe('phases', () => {
  it('off when the admin disables the bonus', () => {
    settings({ enabled: false });
    expect(bonus.bonusPhase()).toBe('off');
  });

  it('waiting while the playoff field or the Wild Card is unknown', () => {
    expect(bonus.bonusPhase()).toBe('waiting');
    openField();
    expect(bonus.bonusPhase()).toBe('waiting'); // no Wild Card game yet
  });

  it('open until the first Wild Card kickoff, then locked', () => {
    openField();
    addGame({ week: 19, kickoff: NOW + 2 * DAY });
    addGame({ week: 19, kickoff: NOW + DAY });
    expect(bonus.bonusLockAt()).toBe(NOW + DAY);
    expect(bonus.bonusPhase(NOW + DAY - 1)).toBe('open');
    expect(bonus.bonusPhase(NOW + DAY)).toBe('locked');
  });
});

describe('revealing picks', () => {
  beforeEach(() => {
    openField();
    addGame({ week: 19, kickoff: NOW + DAY });
  });

  it('at the Wild Card: as soon as it locks', () => {
    expect(bonus.bonusRevealed(NOW)).toBe(false);
    expect(bonus.bonusRevealed(NOW + DAY)).toBe(true);
  });

  it('at the Super Bowl: nothing until the Super Bowl is scheduled', () => {
    settings({ reveal: 'superbowl' });
    expect(bonus.bonusRevealAt()).toBeNull();
    expect(bonus.bonusRevealed(NOW + 10 * DAY)).toBe(false);
  });

  it('at the Super Bowl: at Super Bowl kickoff', () => {
    settings({ reveal: 'superbowl' });
    const sb = NOW + 30 * DAY;
    addGame({ week: 22, kickoff: sb });
    expect(bonus.bonusRevealed(NOW + DAY)).toBe(false);
    expect(bonus.bonusRevealed(sb)).toBe(true);
  });
});

describe('points and tiebreak', () => {
  beforeEach(() => {
    openField();
    addGame({ week: 19, kickoff: NOW - DAY }); // picks locked and revealed (Wild Card)
    choose('Audrey', BUF.id, SF.id, BUF.id, 50); // all correct: 11
    choose('Bud', BUF.id, PHI.id, BUF.id, 46); // AFC + SB: 8
    choose('Bea', KC.id, SF.id, SF.id, 47); // NFC: 3
  });

  it('adds up the points of each correct answer', () => {
    result({ afc: BUF.id, nfc: SF.id, sb: BUF.id, sbTotal: 47 });
    const pts = bonus.bonusPointsByPlayer();
    expect(pts.get(pid('Audrey'))).toBe(11);
    expect(pts.get(pid('Bud'))).toBe(8);
    expect(pts.get(pid('Bea'))).toBe(3);
    expect(pts.has(pid('Gwen'))).toBe(false);
  });

  it('follows the admin\'s scoring', () => {
    settings({ points: { afc: 1, nfc: 1, sb: 10 } });
    result({ afc: BUF.id, nfc: SF.id, sb: BUF.id, sbTotal: 47 });
    expect(bonus.bonusPointsByPlayer().get(pid('Audrey'))).toBe(12);
  });

  it('counts as the playoffs go: the AFC champion scores before the Super Bowl', () => {
    result({ afc: BUF.id });
    expect(bonus.bonusPointsByPlayer().get(pid('Bud'))).toBe(3);
  });

  it('no points while picks are secret', () => {
    settings({ reveal: 'superbowl' });
    result({ afc: BUF.id, nfc: SF.id });
    expect(bonus.bonusPointsByPlayer().size).toBe(0);
  });

  it('no points when the bonus is disabled', () => {
    settings({ enabled: false });
    result({ afc: BUF.id, nfc: SF.id, sb: BUF.id, sbTotal: 47 });
    expect(bonus.bonusPointsByPlayer().size).toBe(0);
    expect(bonus.tiebreakDistances()).toBeNull();
  });

  it('the bonus is added to the season standings', () => {
    result({ afc: BUF.id, nfc: SF.id, sb: BUF.id, sbTotal: 47 });
    const audrey = standings().find((r) => r.name === 'Audrey')!;
    expect(audrey).toMatchObject({ points: 72 + 11, bonus: 11, rank: 1 });
    // …but not to a week's standings.
    expect(standings(19).find((r) => r.name === 'Audrey')!.bonus).toBe(0);
  });

  it('on equal points, the closest to the Super Bowl total ranks higher', () => {
    for (const name of ['Audrey', 'Bud', 'Bea']) setStartPoints(pid(name), 60);
    result({ afc: TEAMS.BAL.id, nfc: TEAMS.DET.id, sb: TEAMS.BAL.id, sbTotal: 47 }); // nobody has bonus points
    const rows = standings().filter((r) => ['Audrey', 'Bud', 'Bea'].includes(r.name));
    expect(rows.map((r) => [r.name, r.rank])).toEqual([
      ['Bea', 3], // off by 0
      ['Bud', 4], // off by 1
      ['Audrey', 5] // off by 3
    ]);
  });

  it('no tiebreak until the Super Bowl is played', () => {
    result({ afc: BUF.id });
    expect(bonus.tiebreakDistances()).toBeNull();
  });
});

describe('tick: playoff field and champions', () => {
  /** Hand-made ESPN standings: n seeds per conference. */
  const espnStandings = (afcSeeds = 7, nfcSeeds = 7): NflStandings => ({
    conferences: (['AFC', 'NFC'] as const).map((abbr) => ({
      abbr,
      divisions: [
        {
          name: `${abbr} East`,
          teams: FIELD[abbr === 'AFC' ? 'afc' : 'nfc'].slice(0, abbr === 'AFC' ? afcSeeds : nfcSeeds).map((t, i) => ({
            teamId: t.teamId,
            record: '10-7',
            streak: null,
            seed: t.seed,
            diff: null,
            divRecord: null,
            divRank: i + 1,
            clinch: 'in' as const
          }))
        }
      ]
    }))
  });

  it('freezes the 14 playoff teams once the regular season is over and the Wild Card is scheduled', async () => {
    addGame({ week: 18, score: [1, 0] });
    addGame({ week: 19, kickoff: NOW + DAY });
    vi.mocked(fetchStandings).mockResolvedValue(espnStandings());
    await bonus.bonusTick();
    expect(bonus.bonusField()).toEqual(FIELD);
    expect(bonus.bonusPhase()).toBe('open');
  });

  it('waits until all of week 18 is final', async () => {
    addGame({ week: 18, score: [1, 0] });
    addGame({ week: 18, status: 'live', score: [1, 0] });
    addGame({ week: 19, kickoff: NOW + DAY });
    await bonus.bonusTick();
    expect(fetchStandings).not.toHaveBeenCalled();
    expect(bonus.bonusField()).toBeNull();
  });

  it('waits until ESPN shows all 7 seeds of each conference', async () => {
    addGame({ week: 18, score: [1, 0] });
    addGame({ week: 19, kickoff: NOW + DAY });
    vi.mocked(fetchStandings).mockResolvedValue(espnStandings(7, 6));
    await bonus.bonusTick();
    expect(bonus.bonusField()).toBeNull();
  });

  it('does nothing when the bonus is disabled', async () => {
    settings({ enabled: false });
    addGame({ week: 18, score: [1, 0] });
    addGame({ week: 19, kickoff: NOW + DAY });
    await bonus.bonusTick();
    expect(fetchStandings).not.toHaveBeenCalled();
  });

  it('records the conference champions, then the Super Bowl and its total', async () => {
    openField();
    addGame({ week: 21, away: 'KC', home: 'BUF', score: [20, 27] });
    addGame({ week: 21, away: 'PHI', home: 'SF', score: [24, 21] });
    await bonus.bonusTick();
    expect(bonus.bonusResult()).toEqual({ afc: BUF.id, nfc: PHI.id, sb: null, sbTotal: null });

    addGame({ week: 22, away: 'PHI', home: 'BUF', score: [17, 30] });
    await bonus.bonusTick();
    expect(bonus.bonusResult()).toEqual({ afc: BUF.id, nfc: PHI.id, sb: BUF.id, sbTotal: 47 });
  });

  it('derives the champions from the two Super Bowl teams if a conference final is missing', async () => {
    openField();
    addGame({ week: 22, away: 'SF', home: 'KC', kickoff: NOW + 3 * HOUR });
    await bonus.bonusTick();
    expect(bonus.bonusResult()).toMatchObject({ afc: KC.id, nfc: SF.id, sb: null });
  });
});

describe('player picks', () => {
  it('a new pick replaces the old one', () => {
    choose('Gwen', BUF.id, SF.id, BUF.id, 40);
    choose('Gwen', KC.id, SF.id, SF.id, 52);
    expect(bonus.bonusPicks()).toEqual([{ playerId: pid('Gwen'), afc: KC.id, nfc: SF.id, sb: SF.id, sbTotal: 52 }]);
  });
});
