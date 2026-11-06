import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NflStandings } from '../../server/espn';

// Le classement NFL vient d'ESPN : on le remplace par une version fabriquée.
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

describe('réglages', () => {
  it('par défaut : activé, 3/3/5, révélation à la Wild Card', () => {
    expect(bonus.bonusSettings()).toEqual({ enabled: true, points: { afc: 3, nfc: 3, sb: 5 }, reveal: 'wildcard' });
  });

  it('garde ce que l’admin a enregistré', () => {
    settings({ enabled: false, points: { afc: 2, nfc: 2, sb: 6 }, reveal: 'superbowl' });
    expect(bonus.bonusSettings()).toEqual({ enabled: false, points: { afc: 2, nfc: 2, sb: 6 }, reveal: 'superbowl' });
  });

  it('retombe sur les valeurs par défaut si les réglages sont illisibles', () => {
    setMeta('bonus_settings', '{pas du json');
    expect(bonus.bonusSettings().points).toEqual({ afc: 3, nfc: 3, sb: 5 });
    setMeta('bonus_settings', JSON.stringify({ enabled: true, reveal: 'n’importe quoi' }));
    expect(bonus.bonusSettings()).toMatchObject({ reveal: 'wildcard', points: { afc: 3, nfc: 3, sb: 5 } });
  });
});

describe('phases', () => {
  it('off quand l’admin désactive le bonus', () => {
    settings({ enabled: false });
    expect(bonus.bonusPhase()).toBe('off');
  });

  it('en attente tant que les qualifiés ou la Wild Card ne sont pas connus', () => {
    expect(bonus.bonusPhase()).toBe('waiting');
    openField();
    expect(bonus.bonusPhase()).toBe('waiting'); // pas encore de match de Wild Card
  });

  it('ouvert jusqu’au premier coup d’envoi de la Wild Card, puis verrouillé', () => {
    openField();
    addGame({ week: 19, kickoff: NOW + 2 * DAY });
    addGame({ week: 19, kickoff: NOW + DAY });
    expect(bonus.bonusLockAt()).toBe(NOW + DAY);
    expect(bonus.bonusPhase(NOW + DAY - 1)).toBe('open');
    expect(bonus.bonusPhase(NOW + DAY)).toBe('locked');
  });
});

describe('révélation des choix', () => {
  beforeEach(() => {
    openField();
    addGame({ week: 19, kickoff: NOW + DAY });
  });

  it('à la Wild Card : dès la clôture', () => {
    expect(bonus.bonusRevealed(NOW)).toBe(false);
    expect(bonus.bonusRevealed(NOW + DAY)).toBe(true);
  });

  it('au Super Bowl : rien tant que le Super Bowl n’est pas au calendrier', () => {
    settings({ reveal: 'superbowl' });
    expect(bonus.bonusRevealAt()).toBeNull();
    expect(bonus.bonusRevealed(NOW + 10 * DAY)).toBe(false);
  });

  it('au Super Bowl : au coup d’envoi du Super Bowl', () => {
    settings({ reveal: 'superbowl' });
    const sb = NOW + 30 * DAY;
    addGame({ week: 22, kickoff: sb });
    expect(bonus.bonusRevealed(NOW + DAY)).toBe(false);
    expect(bonus.bonusRevealed(sb)).toBe(true);
  });
});

describe('points et départage', () => {
  beforeEach(() => {
    openField();
    addGame({ week: 19, kickoff: NOW - DAY }); // choix verrouillés et révélés (Wild Card)
    choose('Audrey', BUF.id, SF.id, BUF.id, 50); // tout bon : 11
    choose('Bud', BUF.id, PHI.id, BUF.id, 46); // AFC + SB : 8
    choose('Bea', KC.id, SF.id, SF.id, 47); // NFC : 3
  });

  it('additionne les points de chaque bonne réponse', () => {
    result({ afc: BUF.id, nfc: SF.id, sb: BUF.id, sbTotal: 47 });
    const pts = bonus.bonusPointsByPlayer();
    expect(pts.get(pid('Audrey'))).toBe(11);
    expect(pts.get(pid('Bud'))).toBe(8);
    expect(pts.get(pid('Bea'))).toBe(3);
    expect(pts.has(pid('Gwen'))).toBe(false);
  });

  it('suit le barème de l’admin', () => {
    settings({ points: { afc: 1, nfc: 1, sb: 10 } });
    result({ afc: BUF.id, nfc: SF.id, sb: BUF.id, sbTotal: 47 });
    expect(bonus.bonusPointsByPlayer().get(pid('Audrey'))).toBe(12);
  });

  it('compte au fil des playoffs : le champion AFC rapporte avant le Super Bowl', () => {
    result({ afc: BUF.id });
    expect(bonus.bonusPointsByPlayer().get(pid('Bud'))).toBe(3);
  });

  it('aucun point tant que les choix sont secrets', () => {
    settings({ reveal: 'superbowl' });
    result({ afc: BUF.id, nfc: SF.id });
    expect(bonus.bonusPointsByPlayer().size).toBe(0);
  });

  it('aucun point quand le bonus est désactivé', () => {
    settings({ enabled: false });
    result({ afc: BUF.id, nfc: SF.id, sb: BUF.id, sbTotal: 47 });
    expect(bonus.bonusPointsByPlayer().size).toBe(0);
    expect(bonus.tiebreakDistances()).toBeNull();
  });

  it('le bonus s’ajoute au classement de la saison', () => {
    result({ afc: BUF.id, nfc: SF.id, sb: BUF.id, sbTotal: 47 });
    const audrey = standings().find((r) => r.name === 'Audrey')!;
    expect(audrey).toMatchObject({ points: 72 + 11, bonus: 11, rank: 1 });
    // …mais pas au classement d'une semaine.
    expect(standings(19).find((r) => r.name === 'Audrey')!.bonus).toBe(0);
  });

  it('à égalité de points, le plus proche du total du Super Bowl passe devant', () => {
    for (const name of ['Audrey', 'Bud', 'Bea']) setStartPoints(pid(name), 60);
    result({ afc: TEAMS.BAL.id, nfc: TEAMS.DET.id, sb: TEAMS.BAL.id, sbTotal: 47 }); // personne n'a de point bonus
    const rows = standings().filter((r) => ['Audrey', 'Bud', 'Bea'].includes(r.name));
    expect(rows.map((r) => [r.name, r.rank])).toEqual([
      ['Bea', 3], // écart 0
      ['Bud', 4], // écart 1
      ['Audrey', 5] // écart 3
    ]);
  });

  it('pas de départage tant que le Super Bowl n’est pas joué', () => {
    result({ afc: BUF.id });
    expect(bonus.tiebreakDistances()).toBeNull();
  });
});

describe('tick : qualifiés et champions', () => {
  /** Classement ESPN fabriqué : n têtes de série par conférence. */
  const espnStandings = (afcSeeds = 7, nfcSeeds = 7): NflStandings => ({
    conferences: (['AFC', 'NFC'] as const).map((abbr) => ({
      abbr,
      divisions: [
        {
          name: `${abbr} Est`,
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

  it('fige les 14 qualifiés une fois la saison régulière finie et la Wild Card au calendrier', async () => {
    addGame({ week: 18, score: [1, 0] });
    addGame({ week: 19, kickoff: NOW + DAY });
    vi.mocked(fetchStandings).mockResolvedValue(espnStandings());
    await bonus.bonusTick();
    expect(bonus.bonusField()).toEqual(FIELD);
    expect(bonus.bonusPhase()).toBe('open');
  });

  it('attend que toute la semaine 18 soit terminée', async () => {
    addGame({ week: 18, score: [1, 0] });
    addGame({ week: 18, status: 'live', score: [1, 0] });
    addGame({ week: 19, kickoff: NOW + DAY });
    await bonus.bonusTick();
    expect(fetchStandings).not.toHaveBeenCalled();
    expect(bonus.bonusField()).toBeNull();
  });

  it('attend qu’ESPN affiche les 7 têtes de série de chaque conférence', async () => {
    addGame({ week: 18, score: [1, 0] });
    addGame({ week: 19, kickoff: NOW + DAY });
    vi.mocked(fetchStandings).mockResolvedValue(espnStandings(7, 6));
    await bonus.bonusTick();
    expect(bonus.bonusField()).toBeNull();
  });

  it('ne fait rien quand le bonus est désactivé', async () => {
    settings({ enabled: false });
    addGame({ week: 18, score: [1, 0] });
    addGame({ week: 19, kickoff: NOW + DAY });
    await bonus.bonusTick();
    expect(fetchStandings).not.toHaveBeenCalled();
  });

  it('note les champions de conférence puis le Super Bowl et son total', async () => {
    openField();
    addGame({ week: 21, away: 'KC', home: 'BUF', score: [20, 27] });
    addGame({ week: 21, away: 'PHI', home: 'SF', score: [24, 21] });
    await bonus.bonusTick();
    expect(bonus.bonusResult()).toEqual({ afc: BUF.id, nfc: PHI.id, sb: null, sbTotal: null });

    addGame({ week: 22, away: 'PHI', home: 'BUF', score: [17, 30] });
    await bonus.bonusTick();
    expect(bonus.bonusResult()).toEqual({ afc: BUF.id, nfc: PHI.id, sb: BUF.id, sbTotal: 47 });
  });

  it('déduit les champions des deux équipes du Super Bowl si une finale de conférence manque', async () => {
    openField();
    addGame({ week: 22, away: 'SF', home: 'KC', kickoff: NOW + 3 * HOUR });
    await bonus.bonusTick();
    expect(bonus.bonusResult()).toMatchObject({ afc: KC.id, nfc: SF.id, sb: null });
  });
});

describe('choix des joueurs', () => {
  it('un nouveau choix remplace l’ancien', () => {
    choose('Gwen', BUF.id, SF.id, BUF.id, 40);
    choose('Gwen', KC.id, SF.id, SF.id, 52);
    expect(bonus.bonusPicks()).toEqual([{ playerId: pid('Gwen'), afc: KC.id, nfc: SF.id, sb: SF.id, sbTotal: 52 }]);
  });
});
