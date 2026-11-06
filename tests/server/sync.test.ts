/**
 * ESPN → database sync: it is what brings in games, scores and statuses.
 * ESPN is replaced by a test double: we choose what it "answers" week by week.
 */
import { rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EspnGame, EspnTeam } from '../../server/espn';

vi.mock('../../server/espn', async (orig) => ({
  ...(await orig<typeof import('../../server/espn')>()),
  fetchTeams: vi.fn(),
  fetchWeek: vi.fn()
}));
const espn = await import('../../server/espn');
const sync = await import('../../server/sync');
const { DAY, HOUR, NOW, TEAMS, addGame, db, resetDb } = await import('./helpers');

const MIN = 60_000;
const fetchTeams = vi.mocked(espn.fetchTeams);
const fetchWeek = vi.mocked(espn.fetchWeek);

const team = (abbr: keyof typeof TEAMS): EspnTeam => ({
  id: TEAMS[abbr].id,
  abbr,
  name: TEAMS[abbr].name,
  displayName: `${abbr} ${TEAMS[abbr].name}`,
  color: '112233',
  altColor: 'ffffff'
});
const espnGame = (o: Partial<EspnGame> = {}): EspnGame => ({
  id: 'e1',
  week: 10,
  kickoff: NOW + DAY,
  status: 'scheduled',
  detail: null,
  awayId: TEAMS.BUF.id,
  homeId: TEAMS.KC.id,
  awayScore: null,
  homeScore: null,
  winner: null,
  ...o
});
const row = (id: string) => db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined;
/** Weeks requested from ESPN since the last call. */
const weeksAsked = () => {
  const w = fetchWeek.mock.calls.map(([, week]) => week);
  fetchWeek.mockClear();
  return w;
};

/** Logos: 404, so nothing is written to disk (except in the test that cares about it). */
const logoFetch = vi.fn(async () => new Response(null, { status: 404 }));

beforeEach(() => {
  resetDb();
  sync.resetSyncClock();
  fetchTeams.mockReset().mockResolvedValue(Object.keys(TEAMS).map((a) => team(a as keyof typeof TEAMS)));
  fetchWeek.mockReset().mockResolvedValue([]);
  logoFetch.mockClear();
  vi.stubGlobal('fetch', logoFetch);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('games of a week', () => {
  it('adds games, then updates score and status on the next run', async () => {
    fetchWeek.mockResolvedValue([espnGame()]);
    expect(await sync.syncWeek(10)).toBe(1);
    expect(row('e1')).toMatchObject({ season: 2026, week: 10, status: 'scheduled', away_score: null, winner: null });

    fetchWeek.mockResolvedValue([espnGame({ status: 'final', detail: 'Terminé', awayScore: 27, homeScore: 24, winner: 'away' })]);
    await sync.syncWeek(10);
    expect(row('e1')).toMatchObject({ status: 'final', detail: 'Terminé', away_score: 27, home_score: 24, winner: 'away' });
    expect((db.prepare('SELECT COUNT(*) AS n FROM games').get() as { n: number }).n).toBe(1);
  });

  it('follows a rescheduled game (new date, new week)', async () => {
    fetchWeek.mockResolvedValue([espnGame()]);
    await sync.syncWeek(10);
    fetchWeek.mockResolvedValue([espnGame({ week: 12, kickoff: NOW + 15 * DAY })]);
    await sync.syncWeek(12);
    expect(row('e1')).toMatchObject({ week: 12, kickoff: NOW + 15 * DAY });
  });

  it('ignores a game with an unknown team (e.g. AFC/NFC Pro Bowl)', async () => {
    fetchWeek.mockResolvedValue([espnGame(), espnGame({ id: 'probowl', awayId: '31', homeId: '32' })]);
    expect(await sync.syncWeek(10)).toBe(1);
    expect(row('probowl')).toBeUndefined();
  });

  it('keeps picks when the game is updated', async () => {
    fetchWeek.mockResolvedValue([espnGame()]);
    await sync.syncWeek(10);
    db.prepare("INSERT INTO picks (player_id, game_id, side, updated_at) VALUES (1, 'e1', 'away', 0)").run();
    fetchWeek.mockResolvedValue([espnGame({ status: 'live', awayScore: 7, homeScore: 0 })]);
    await sync.syncWeek(10);
    expect(db.prepare("SELECT side FROM picks WHERE game_id = 'e1'").get()).toEqual({ side: 'away' });
  });
});

describe('teams and logos', () => {
  it('updates teams and only downloads missing logos', async () => {
    rmSync(sync.LOGO_DIR, { recursive: true, force: true });
    fetchTeams.mockResolvedValue([{ ...team('BUF'), color: 'abcdef' }]);
    logoFetch.mockImplementation(async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 }));
    expect(await sync.syncTeams()).toBe(1);
    expect(db.prepare("SELECT color FROM teams WHERE abbr = 'BUF'").get()).toEqual({ color: 'abcdef' });
    expect(logoFetch).toHaveBeenCalledTimes(2); // light and dark

    logoFetch.mockClear();
    await sync.syncTeams();
    expect(logoFetch).not.toHaveBeenCalled();
    rmSync(sync.LOGO_DIR, { recursive: true, force: true });
  });

  it('an unavailable logo does not block the sync', async () => {
    rmSync(sync.LOGO_DIR, { recursive: true, force: true });
    fetchTeams.mockResolvedValue([team('KC')]);
    logoFetch.mockRejectedValue(new Error('network'));
    await expect(sync.syncTeams()).resolves.toBe(1);
  });
});

describe('full season', () => {
  it('requests all 22 weeks (regular season and playoffs)', async () => {
    await sync.syncSeason();
    expect(weeksAsked()).toEqual([...Array.from({ length: 18 }, (_, i) => i + 1), 19, 20, 21, 22]);
  });

  it('a few failing weeks: the rest is kept', async () => {
    fetchWeek.mockImplementation(async (_s, w) => {
      if (w === 3) throw new Error('ESPN answered 500');
      return w === 10 ? [espnGame()] : [];
    });
    expect(await sync.syncSeason()).toBe(1);
  });

  it('everything failing: the error propagates (to retry)', async () => {
    fetchWeek.mockRejectedValue(new Error('ESPN unreachable'));
    await expect(sync.syncSeason()).rejects.toThrow('ESPN unreachable');
  });
});

describe('sync pace (called every minute)', () => {
  it('on start: full sync, then nothing while no game is near', async () => {
    await sync.syncTick(NOW);
    expect(fetchTeams).toHaveBeenCalledTimes(1);
    expect(weeksAsked()).toHaveLength(22);
    expect(sync.syncStatus()).toMatchObject({ ok: true, message: '8 équipes, 0 matchs' });

    await sync.syncTick(NOW + MIN);
    await sync.syncTick(NOW + 30 * MIN);
    expect(fetchTeams).toHaveBeenCalledTimes(1);
    expect(weeksAsked()).toEqual([]);
  });

  it('new season (June 1): full sync right away, without waiting for the next day', async () => {
    await sync.syncTick(NOW);
    weeksAsked();
    process.env.SEASON = '2027';
    try {
      await sync.syncTick(NOW + MIN);
      expect(new Set(fetchWeek.mock.calls.map(([season]) => season))).toEqual(new Set([2027]));
      expect(weeksAsked()).toHaveLength(22);
      await sync.syncTick(NOW + 2 * MIN);
      expect(weeksAsked()).toEqual([]);
    } finally {
      process.env.SEASON = '2026';
    }
  });

  it('during games: the current week every 2 minutes', async () => {
    await sync.syncTick(NOW);
    weeksAsked();
    addGame({ week: 10, kickoff: NOW - HOUR, status: 'live', score: [7, 0] });
    addGame({ week: 11, kickoff: NOW + 7 * DAY });

    await sync.syncTick(NOW + 2 * MIN);
    expect(weeksAsked()).toEqual([10]);
    await sync.syncTick(NOW + 3 * MIN);
    expect(weeksAsked()).toEqual([]);
    await sync.syncTick(NOW + 4 * MIN);
    expect(weeksAsked()).toEqual([10]);
  });

  it('a game starting in 10 minutes is already closely tracked', async () => {
    await sync.syncTick(NOW);
    weeksAsked();
    addGame({ week: 10, kickoff: NOW + 12 * MIN });
    await sync.syncTick(NOW + 2 * MIN);
    expect(weeksAsked()).toEqual([10]);
  });

  it('a game "live" for more than 8 h is no longer closely tracked', async () => {
    await sync.syncTick(NOW);
    weeksAsked();
    addGame({ week: 9, kickoff: NOW - 9 * HOUR, status: 'live', score: [7, 0] });
    await sync.syncTick(NOW + 2 * MIN);
    expect(weeksAsked()).toEqual([]);
  });

  it('every hour: weeks with a game in the past 4 days or next 8 days', async () => {
    await sync.syncTick(NOW);
    weeksAsked();
    addGame({ week: 9, kickoff: NOW - 3 * DAY, score: [1, 0] });
    addGame({ week: 10, kickoff: NOW + 2 * DAY });
    addGame({ week: 8, kickoff: NOW - 10 * DAY, score: [1, 0] });
    addGame({ week: 12, kickoff: NOW + 15 * DAY });

    await sync.syncTick(NOW + 59 * MIN);
    expect(weeksAsked()).toEqual([]);
    await sync.syncTick(NOW + HOUR);
    expect(weeksAsked().sort()).toEqual([10, 9].sort());
  });

  it('once a day: the full season again', async () => {
    await sync.syncTick(NOW);
    await sync.syncTick(NOW + 24 * HOUR);
    expect(fetchTeams).toHaveBeenCalledTimes(2);
  });

  it('failed full sync: retries the next minute, not the next day', async () => {
    fetchTeams.mockRejectedValueOnce(new Error('ESPN unreachable (ENOTFOUND)'));
    await expect(sync.syncTick(NOW)).rejects.toThrow('ENOTFOUND');
    expect(sync.syncStatus()).toMatchObject({ ok: false, message: 'ESPN unreachable (ENOTFOUND)' });

    await sync.syncTick(NOW + MIN);
    expect(fetchTeams).toHaveBeenCalledTimes(2);
    expect(sync.syncStatus().ok).toBe(true);
  });
});

describe('"Sync now" button', () => {
  it('waits for the running sync instead of running a second one', async () => {
    let running = 0;
    let overlap = false;
    fetchTeams.mockImplementation(async () => {
      running++;
      if (running > 1) overlap = true;
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return [team('BUF')];
    });
    await Promise.all([sync.syncTick(NOW), sync.forceSync(), sync.forceSync()]);
    expect(fetchTeams).toHaveBeenCalledTimes(3);
    expect(overlap).toBe(false);
  });

  it('an error does not block later syncs', async () => {
    fetchTeams.mockRejectedValueOnce(new Error('outage'));
    await expect(sync.forceSync()).rejects.toThrow('outage');
    await expect(sync.forceSync()).resolves.toBeUndefined();
  });

  it('status shown to the admin before any sync', () => {
    expect(sync.syncStatus()).toEqual({ at: null, ok: false, message: 'Pas encore de synchro', games: 0 });
  });
});
