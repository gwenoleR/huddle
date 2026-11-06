/** Notifications: who gets what, and never twice. Actual sending is replaced by a test double. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const sendNotification = vi.fn();
vi.mock('web-push', () => ({
  default: { generateVAPIDKeys: () => ({ publicKey: 'pub', privateKey: 'priv' }), setVapidDetails: () => {}, sendNotification }
}));

const { notificationsTick, sendToPlayer } = await import('../../server/push');
const { DAY, HOUR, NOW, TEAMS, addGame, db, pick, picks, pid, resetDb, setGame, setMeta, subscribe } = await import('./helpers');
const { saveBonusPick } = await import('../../server/bonus');

/** Notifications sent since the last call, with the recipient's name. */
function sent(): { to: string; title: string; body: string; url?: string }[] {
  const out = sendNotification.mock.calls.map(([sub, payload]) => ({ to: sub.endpoint.split('/').at(-1), ...JSON.parse(payload) }));
  sendNotification.mockClear();
  return out;
}

beforeEach(() => {
  resetDb();
  sendNotification.mockReset().mockResolvedValue({});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const name of ['Gwen', 'Audrey', 'Bea']) subscribe(name); // Bud and Max haven't enabled notifications
});
afterEach(() => vi.useRealTimers());

describe('sending', () => {
  it('removes an expired subscription (410) and carries on', async () => {
    subscribe('Gwen', 'https://push.example/Gwen-2');
    sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    expect(await sendToPlayer(pid('Gwen'), { title: 't', body: 'b' })).toBe(1);
    const left = db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE player_id = ?').get(pid('Gwen')) as { n: number };
    expect(left.n).toBe(1);
  });
});

describe('reminder before kickoff', () => {
  it('notifies those without a pick ~1 h before, only once', async () => {
    const g = addGame({ week: 10, kickoff: NOW + HOUR, away: 'BUF', home: 'KC' });
    pick('Gwen', g, 'away');
    await notificationsTick(NOW);
    const out = sent();
    expect(out.map((n) => n.to).sort()).toEqual(['Audrey', 'Bea']);
    expect(out[0]).toMatchObject({ title: 'Il te manque un prono', body: 'Coup d\'envoi à 20:00 : BUF @ KC' });
    await notificationsTick(NOW + 60_000);
    expect(sent()).toEqual([]);
  });

  it('groups games in the same time slot', async () => {
    addGame({ week: 10, kickoff: NOW + HOUR, away: 'BUF', home: 'KC' });
    addGame({ week: 10, kickoff: NOW + HOUR, away: 'SF', home: 'DAL' });
    await notificationsTick(NOW);
    expect(sent().find((n) => n.to === 'Bea')).toMatchObject({ title: 'Il te manque 2 pronos', body: expect.stringContaining('BUF @ KC, SF @ DAL') });
  });

  it('nothing too early, nor for weeks before the start week', async () => {
    addGame({ week: 10, kickoff: NOW + 2 * HOUR });
    addGame({ week: 8, kickoff: NOW + HOUR });
    await notificationsTick(NOW);
    expect(sent()).toEqual([]);
  });
});

describe('your pick flips', () => {
  const live = (score: [number, number], detail: string) => addGame({ id: 'g', week: 10, status: 'live', score, detail, away: 'BUF', home: 'KC' });

  it('notifies when the leading team changes in the fourth quarter', async () => {
    live([10, 7], 'Q4 · 8:00');
    picks('g', { Gwen: 'away', Audrey: 'home' });
    pick('Bud', 'g', 'away'); // not subscribed
    await notificationsTick(NOW);
    expect(sent()).toEqual([]); // first reading: just records who leads

    setGame('g', { home_score: 14, detail: 'Q4 · 3:10' });
    await notificationsTick(NOW);
    const out = sent();
    expect(out).toHaveLength(2);
    expect(out.find((n) => n.to === 'Audrey')).toMatchObject({ title: 'Ça tourne pour toi !', url: '/#/match/g' });
    expect(out.find((n) => n.to === 'Gwen')).toMatchObject({
      title: 'Aïe, ça bascule…',
      body: 'Les Chiefs passent devant : BUF 10–14 KC (Q4 · 3:10). Ton prono sur les Bills est en danger.'
    });
  });

  it('nothing before the fourth quarter, but the change is recorded', async () => {
    live([10, 7], 'Q2 · 5:00');
    picks('g', { Gwen: 'away' });
    await notificationsTick(NOW);
    setGame('g', { home_score: 14, detail: 'Q3 · 1:00' });
    await notificationsTick(NOW);
    expect(sent()).toEqual([]);
    setGame('g', { detail: 'Q4 · 14:00' }); // KC still ahead: no flip
    await notificationsTick(NOW);
    expect(sent()).toEqual([]);
  });

  it('a tie is not a flip', async () => {
    live([10, 7], 'Q4 · 5:00');
    picks('g', { Gwen: 'away' });
    await notificationsTick(NOW);
    setGame('g', { home_score: 10 });
    await notificationsTick(NOW);
    setGame('g', { away_score: 13 }); // BUF back in front: same team as before
    await notificationsTick(NOW);
    expect(sent()).toEqual([]);
  });

  it('a comeback seen only at the final whistle counts too', async () => {
    live([20, 17], 'Q4 · 0:30');
    picks('g', { Gwen: 'away', Audrey: 'home' });
    await notificationsTick(NOW);
    setGame('g', { status: 'final', home_score: 23, winner: 'home', detail: 'Terminé' });
    await notificationsTick(NOW);
    const out = sent();
    expect(out.find((n) => n.to === 'Audrey')!.title).toBe('Renversement final, ton prono passe !');
    expect(out.find((n) => n.to === 'Gwen')!.title).toBe('Crucifié sur le fil…');
    expect(db.prepare("SELECT 1 FROM meta WHERE key = 'lead:g'").get()).toBeUndefined();
    await notificationsTick(NOW);
    expect(sent().filter((n) => n.url === '/#/match/g')).toEqual([]);
  });
});

describe('end of week', () => {
  it('sends the recap once all games are final, only once', async () => {
    const g1 = addGame({ week: 10, kickoff: NOW - DAY, score: [24, 17] });
    const g2 = addGame({ week: 10, kickoff: NOW - HOUR, status: 'live', score: [0, 3] });
    picks(g1, { Bea: 'away' });
    await notificationsTick(NOW);
    expect(sent().filter((n) => n.title.includes('terminée'))).toEqual([]);

    setGame(g2, { status: 'final', winner: 'home' });
    await notificationsTick(NOW);
    const out = sent().filter((n) => n.title === 'Semaine 10 terminée');
    expect(out.map((n) => n.to).sort()).toEqual(['Audrey', 'Bea', 'Gwen']);
    expect(out.find((n) => n.to === 'Bea')!.body).toBe('Tu as fait 1 sur 2. Tu es 2e avec 72 pts.'); // tied with Audrey
    await notificationsTick(NOW);
    expect(sent()).toEqual([]);
  });

  it('no recap for an old week on first start', async () => {
    addGame({ week: 9, kickoff: NOW - 10 * DAY, score: [24, 17] });
    await notificationsTick(NOW);
    expect(sent()).toEqual([]);
  });
});

describe('end-of-season bonus', () => {
  const open = (lockIn: number) => {
    setMeta('bonus_field:2026', JSON.stringify({ afc: [{ teamId: TEAMS.BUF.id, seed: 1 }], nfc: [{ teamId: TEAMS.SF.id, seed: 1 }] }));
    addGame({ week: 19, kickoff: NOW + lockIn });
  };

  it('announces the opening only once', async () => {
    open(3 * DAY);
    await notificationsTick(NOW);
    const out = sent();
    expect(out.map((n) => n.to).sort()).toEqual(['Audrey', 'Bea', 'Gwen']);
    expect(out[0]).toMatchObject({ title: 'Bonus de fin de saison ouvert 🏆', body: expect.stringContaining('jusqu\'à 11 pts'), url: '/#/bonus' });
    await notificationsTick(NOW + 60_000);
    expect(sent()).toEqual([]);
  });

  it('reminder ~1 h before lock, only to those who have not picked', async () => {
    open(HOUR);
    saveBonusPick({ playerId: pid('Gwen'), afc: TEAMS.BUF.id, nfc: TEAMS.SF.id, sb: TEAMS.BUF.id, sbTotal: 45 });
    await notificationsTick(NOW);
    const reminders = sent().filter((n) => n.title === 'Ton bonus de fin de saison 🏆');
    expect(reminders.map((n) => n.to).sort()).toEqual(['Audrey', 'Bea']);
    await notificationsTick(NOW + 60_000);
    expect(sent()).toEqual([]);
  });

  it('nothing when the bonus is disabled', async () => {
    setMeta('bonus_settings', JSON.stringify({ enabled: false, points: { afc: 3, nfc: 3, sb: 5 }, reveal: 'wildcard' }));
    open(HOUR);
    await notificationsTick(NOW);
    expect(sent().filter((n) => n.url === '/#/bonus')).toEqual([]);
  });
});
