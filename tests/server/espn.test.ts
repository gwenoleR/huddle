/**
 * Parsing ESPN responses, using real recorded responses (tests/fixtures/espn).
 * If ESPN changes its format, this is where it breaks, not on the players' phones.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { espnStats, fetchLive, fetchPreview, fetchStandings, fetchTeams, fetchWeek, fromAppWeek, resetEspnStats, toAppWeek } from '../../server/espn';

const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/espn/${name}.json`, 'utf8'));
const clone = <T>(x: T): T => structuredClone(x);

/** Serves a hand-made response on each call and records the requested URLs. */
let calls: string[] = [];
function serve(body: unknown | ((url: string) => unknown), status = 200) {
  calls = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    const data = typeof body === 'function' ? (body as (u: string) => unknown)(url) : body;
    return new Response(JSON.stringify(data), { status });
  });
}
beforeEach(() => serve({}));
afterEach(() => vi.unstubAllGlobals());

describe('ESPN weeks ↔ app weeks', () => {
  it('regular season: same numbers', () => {
    expect(toAppWeek(2, 1)).toBe(1);
    expect(toAppWeek(2, 18)).toBe(18);
    expect(fromAppWeek(9)).toEqual({ seasonType: 2, week: 9 });
  });

  it('playoffs: 19 to 22, skipping the Pro Bowl', () => {
    expect([1, 2, 3, 5].map((w) => toAppWeek(3, w))).toEqual([19, 20, 21, 22]);
    expect(toAppWeek(3, 4)).toBeNull(); // Pro Bowl
    expect(toAppWeek(1, 2)).toBeNull(); // preseason
    expect(fromAppWeek(22)).toEqual({ seasonType: 3, week: 5 });
  });
});

describe('teams', () => {
  it('reads the 32 teams with colors', async () => {
    serve(fixture('teams'));
    const teams = await fetchTeams();
    expect(teams).toHaveLength(32);
    expect(teams.find((t) => t.abbr === 'BUF')).toEqual({ id: '2', abbr: 'BUF', name: 'Bills', displayName: 'Buffalo Bills', color: expect.any(String), altColor: expect.any(String) });
  });
});

describe('schedule and scores', () => {
  it('calls the right scoreboard', async () => {
    serve({ events: [] });
    await fetchWeek(2026, 21);
    expect(calls[0]).toContain('/scoreboard?seasontype=3&week=3&dates=2026');
  });

  it('final games: score, winner and overtime', async () => {
    serve(fixture('scoreboard-final'));
    const games = await fetchWeek(2026, 8);
    expect(games).toHaveLength(14);
    expect(games[0]).toEqual({
      id: '401873023',
      week: 8,
      kickoff: Date.parse('2026-10-30T00:15:00Z'),
      status: 'final',
      detail: 'Terminé',
      awayId: '29',
      homeId: '9',
      awayScore: 19,
      homeScore: 27,
      winner: 'home'
    });
    expect(games.find((g) => g.id === '401873024')).toMatchObject({ detail: 'Terminé · prol.', winner: 'away', awayScore: 33, homeScore: 30 });
  });

  it('upcoming games: no score, no winner', async () => {
    serve(fixture('scoreboard-scheduled'));
    const games = await fetchWeek(2026, 9);
    expect(games).toHaveLength(15);
    expect(games.every((g) => g.status === 'scheduled' && g.awayScore === null && g.winner === null && g.detail === null)).toBe(true);
  });

  /** A game from the recorded file, modified to simulate another state. */
  async function liveAs(status: object, scores: [string, string] = ['14', '10'], winners: [boolean, boolean] = [false, false]) {
    const sb = fixture('scoreboard-final');
    const e = clone(sb.events[0]);
    e.status = status;
    e.competitions[0].competitors.forEach((c: any) => {
      c.score = c.homeAway === 'away' ? scores[0] : scores[1];
      c.winner = c.homeAway === 'away' ? winners[0] : winners[1];
    });
    serve({ events: [e] });
    return (await fetchWeek(2026, 10))[0];
  }

  it('live: quarter and clock in French', async () => {
    expect(await liveAs({ period: 2, displayClock: '4:12', type: { state: 'in', name: 'STATUS_IN_PROGRESS' } })).toMatchObject({
      status: 'live',
      detail: 'Q2 · 4:12',
      awayScore: 14,
      homeScore: 10,
      winner: null
    });
    expect((await liveAs({ period: 2, type: { state: 'in', name: 'STATUS_HALFTIME' } })).detail).toBe('Mi-temps');
    expect((await liveAs({ period: 3, type: { state: 'in', name: 'STATUS_END_PERIOD' } })).detail).toBe('Fin Q3');
    expect((await liveAs({ period: 5, displayClock: '7:00', type: { state: 'in', name: 'STATUS_IN_PROGRESS' } })).detail).toBe('Prol. · 7:00');
  });

  it('tie after overtime', async () => {
    const g = await liveAs({ period: 5, type: { state: 'post', name: 'STATUS_FINAL', detail: 'Final/OT' } }, ['20', '20']);
    expect(g).toMatchObject({ status: 'final', winner: 'tie', detail: 'Terminé · prol.' });
  });

  it('postponed game: no score', async () => {
    const g = await liveAs({ period: 0, type: { state: 'pre', name: 'STATUS_POSTPONED' } });
    expect(g).toMatchObject({ status: 'postponed', detail: 'Reporté', awayScore: null, homeScore: null });
  });

  it('ignores an event without both teams', async () => {
    serve({ events: [{ id: '1', date: '2026-11-08T18:00Z', status: {}, competitions: [{ competitors: [] }] }] });
    expect(await fetchWeek(2026, 10)).toEqual([]);
  });
});

describe('preview', () => {
  it('records, form, chances, favorite and injuries (BUF @ MIN)', async () => {
    serve(fixture('summary-scheduled'));
    const p = await fetchPreview('401873051');
    expect(calls[0]).toContain('/summary?event=401873051');
    expect(p.odds).toEqual({ favorite: 'away', spread: 3.5, provider: 'DraftKings' });
    expect(p.away).toMatchObject({ record: '6-1', venueRecord: '3-0', winChance: 64 });
    expect(p.home).toMatchObject({ record: '6-1', winChance: 36, injuredReserve: 2 });
    expect(p.away.form).toHaveLength(5);
    expect(p.away.form[4]).toEqual({ result: 'W', opponent: 'BAL', home: true, score: '36-10' });
    expect(p.home.form[4]).toMatchObject({ result: 'L', opponent: 'DET', home: false });
  });

  it('injuries: most serious first, then by position (QB first), in French', async () => {
    serve(fixture('summary-scheduled'));
    const { home } = await fetchPreview('401873051');
    expect(home.injuries[0]).toEqual({ name: 'Kyler Murray', position: 'QB', status: 'questionable', part: 'ischios' });
    const d = clone(fixture('summary-scheduled'));
    const team = d.injuries.find((t: any) => t.team.abbreviation === 'MIN');
    team.injuries.push({ status: 'Out', athlete: { displayName: 'Missing Player', position: { abbreviation: 'CB' } }, details: { type: 'Knee' } });
    serve(d);
    const again = await fetchPreview('401873051');
    expect(again.home.injuries[0]).toEqual({ name: 'Missing Player', position: 'CB', status: 'out', part: 'genou' });
  });

  it('without odds or prediction: the rest is still shown', async () => {
    const d = clone(fixture('summary-scheduled'));
    delete d.pickcenter;
    delete d.predictor;
    serve(d);
    const p = await fetchPreview('401873051');
    expect(p.odds).toBeNull();
    expect(p.away.winChance).toBeNull();
    expect(p.away.record).toBe('6-1');
  });
});

describe('during and after the game', () => {
  it('final game (CAR @ GB): win-probability curve, scoring plays, stats and leaders', async () => {
    serve(fixture('summary-final'));
    const l = await fetchLive('401873023', false);
    expect(l.length).toBe(3600);
    expect(l.situation).toBeNull();
    expect(l.winProb.length).toBeGreaterThan(100);
    // The curve always moves forward in time and stays between 0 and 100.
    expect(l.winProb.every((p, i) => p.away >= 0 && p.away <= 100 && (i === 0 || p.t >= l.winProb[i - 1].t))).toBe(true);
    expect(l.winProb.at(-1)!.away).toBeLessThan(5); // Green Bay (home) won
    expect(l.scoring[0]).toEqual({ side: 'away', period: 1, clock: '11:43', kind: 'Field goal', text: 'Ryan Fitzgerald, 39 yards', away: 3, home: 0 });
    expect(l.scoring[1].text).toBe('Passe de Jordan Love pour Tucker Kraft, 12 yards');
    expect(l.scoring[2].text).toBe('Course de Chuba Hubbard, 1 yard');
    expect(l.scoring.at(-1)).toMatchObject({ away: 19, home: 27 });
    expect(l.stats.find((s) => s.label === 'Conversions en 3e tentative')).toMatchObject({ away: '5/18', home: '9/16' });
    expect(l.stats.find((s) => s.label === 'Pénalités')).toMatchObject({ away: '5 (41 yds)', awayValue: 41, lowerIsBetter: true });
    expect(l.stats.find((s) => s.label === 'Possession')).toMatchObject({ away: '28 min 57', awayValue: 1737 });
    expect(l.leaders.map((x) => x.category)).toEqual(['À la passe', 'À la course', 'À la réception']);
    expect(l.leaders[1].away).toEqual({ name: 'Chuba Hubbard', line: '22 courses, 81 yds, 1 TD' });
  });

  it('removes an isolated outlier point from the curve', async () => {
    const d = clone(fixture('summary-final'));
    const wp = d.winprobability;
    const before = (await (serve(d), fetchLive('x', false))).winProb.length;
    const mid = Math.floor(wp.length / 2);
    wp[mid].homeWinPercentage = wp[mid].homeWinPercentage > 0.5 ? 0.01 : 0.99;
    serve(d);
    const l = await fetchLive('x', false);
    expect(l.winProb.length).toBe(before - 1);
  });

  it('live: possession, down, red zone and last play', async () => {
    const d = clone(fixture('summary-final'));
    d.header.competitions[0].status.type.state = 'in';
    const gb = d.header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').id;
    d.drives.current = {
      team: { id: gb },
      plays: [
        {
          id: 'live-1',
          type: { text: 'Rush' },
          statYardage: 7,
          period: { number: 4 },
          clock: { displayValue: '2:00' },
          start: { team: { id: gb } },
          end: { downDistanceText: '2nd & 3 at CAR 15', yardsToEndzone: 15, team: { id: gb } }
        },
        { id: 'live-2', type: { text: 'Timeout' }, period: { number: 4 }, clock: { displayValue: '1:58' }, start: {}, end: {} }
      ]
    };
    serve(d);
    const l = await fetchLive('x', false);
    expect(l.situation).toEqual({ possession: 'home', down: '2e et 3 · CAR 15', redZone: true, lastPlay: 'Course de 7 yards', lastSide: 'home' });
  });

  it('overtime: the time axis extends (10 min in the regular season, 15 in the playoffs)', async () => {
    const d = clone(fixture('summary-final'));
    const last = d.drives.previous.at(-1).plays.at(-1);
    d.drives.previous.at(-1).plays.push({ ...last, id: 'ot-1', type: { text: 'Rush' }, period: { number: 5 }, clock: { displayValue: '5:00' } });
    d.winprobability.push({ playId: 'ot-1', homeWinPercentage: 0.5 });
    serve(d);
    expect((await fetchLive('x', false)).length).toBe(4200);
    serve(d);
    const po = await fetchLive('x', true);
    expect(po.length).toBe(4500);
    expect(po.winProb.at(-1)!.t).toBe(3600 + 600);
  });
});

describe('NFL standings', () => {
  it('8 divisions in French, records, streaks and seeds', async () => {
    serve(fixture('standings'));
    const s = await fetchStandings(2026);
    expect(calls[0]).toContain('/apis/v2/sports/football/nfl/standings?season=2026&level=3');
    expect(s.conferences.map((c) => c.abbr)).toEqual(['AFC', 'NFC']);
    expect(s.conferences.flatMap((c) => c.divisions.map((d) => d.name))).toEqual([
      'AFC Est', 'AFC Nord', 'AFC Sud', 'AFC Ouest', 'NFC Est', 'NFC Nord', 'NFC Sud', 'NFC Ouest'
    ]);
    expect(s.conferences.flatMap((c) => c.divisions.flatMap((d) => d.teams))).toHaveLength(32);
    expect(s.conferences[0].divisions[0].teams[0]).toEqual({
      teamId: '2', record: '6-1', streak: '3 V', seed: 1, diff: '+52', divRecord: '0-1', divRank: 1, clinch: null
    });
    expect(s.conferences[0].divisions[0].teams[2].streak).toBe('3 D');
  });

  it('clinched and eliminated at the end of the season', async () => {
    const d = clone(fixture('standings'));
    const entries = d.children[0].children[0].standings.entries;
    entries[0].stats.push({ name: 'clincher', displayValue: 'z' });
    entries[3].stats.push({ name: 'clincher', displayValue: 'e' });
    serve(d);
    const teams = (await fetchStandings(2026)).conferences[0].divisions[0].teams;
    expect(teams[0].clinch).toBe('in');
    expect(teams[3].clinch).toBe('out');
  });
});

describe('ESPN errors', () => {
  it('an error response is reported with its status code', async () => {
    serve({}, 503);
    await expect(fetchWeek(2026, 10)).rejects.toThrow('ESPN a répondu 503');
  });

  it('a network problem gives the real cause', async () => {
    vi.stubGlobal('fetch', async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    });
    await expect(fetchTeams()).rejects.toThrow('ESPN injoignable (ENOTFOUND)');
  });
});

describe('ESPN limits', () => {
  beforeEach(() => {
    resetEspnStats();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-11-08T18:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('counts calls and errors over the last hour and day', async () => {
    serve({ events: [] });
    await fetchWeek(2026, 10);
    vi.setSystemTime(Date.now() + 2 * 3600_000);
    await fetchWeek(2026, 10);
    serve({}, 500);
    await expect(fetchWeek(2026, 10)).rejects.toThrow();
    expect(espnStats()).toEqual({ lastHour: 2, lastDay: 3, errorsLastHour: 1, pausedUntil: null });
  });

  it('429: no more calls for 5 min, then 10 if it happens again', async () => {
    const t0 = Date.now();
    serve({}, 429);
    await expect(fetchWeek(2026, 10)).rejects.toThrow('429');
    expect(espnStats().pausedUntil).toBe(t0 + 5 * 60_000);

    serve({ events: [] });
    await expect(fetchWeek(2026, 10)).rejects.toThrow('ESPN en pause encore 5 min');
    expect(calls).toEqual([]); // ESPN wasn't even called

    vi.setSystemTime(t0 + 5 * 60_000);
    serve({}, 429);
    await expect(fetchWeek(2026, 10)).rejects.toThrow('429');
    expect(espnStats().pausedUntil).toBe(t0 + 15 * 60_000);
  });

  it('the pause goes back down to 5 min after a successful call', async () => {
    const t0 = Date.now();
    serve({}, 429);
    await expect(fetchWeek(2026, 10)).rejects.toThrow();
    vi.setSystemTime(t0 + 5 * 60_000);
    serve({ events: [] });
    await fetchWeek(2026, 10);
    serve({}, 429);
    await expect(fetchWeek(2026, 10)).rejects.toThrow();
    expect(espnStats().pausedUntil).toBe(t0 + 10 * 60_000);
  });
});
