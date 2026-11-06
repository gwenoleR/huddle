// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameDetailDto, GameDto, Side, TeamDto, WeekDto } from '../../web/src/lib/api';
import { usePick, useWeek } from '../../web/src/lib/data';
import { keys } from '../../web/src/lib/queries';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const team = (abbr: string): TeamDto => ({ abbr, name: abbr, fullName: abbr, color: '#000', textColor: '#fff', logo: '', logoDark: '' });
const game: GameDto = {
  id: 'g1',
  week: 10,
  kickoff: Date.now() + 3600_000,
  status: 'scheduled',
  detail: null,
  locked: false,
  points: 1,
  away: team('BUF'),
  home: team('KC'),
  score: null,
  winner: null,
  myPick: null,
  pickers: { away: ['Audrey'], home: [] }
};
const weekData: WeekDto = { week: 10, label: 'Semaine 10', points: 1, games: [game] };
const detail: GameDetailDto = { ...game, weekLabel: 'Semaine 10', waiting: ['Bea', 'Gwen'], counted: true };
const me = { id: 3, name: 'Bea', isAdmin: false };

let qc: QueryClient;
let el: HTMLDivElement;
let root: Root;
/** Server response to the pick, chosen by each test; refetches return the "server" state. */
let pickStatus = 200;
let resolvePick: () => void = () => {};
const calls: string[] = [];

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(keys.week(10), weekData);
  qc.setQueryData(keys.game('g1'), detail);
  calls.length = 0;
  pickStatus = 200;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (init?.method === 'PUT') {
        await new Promise<void>((r) => (resolvePick = r));
        return new Response(JSON.stringify(pickStatus === 200 ? { ok: true } : { error: 'Trop tard, le match a commencé.' }), { status: pickStatus });
      }
      return new Response(JSON.stringify(url.includes('/weeks/') ? weekData : detail));
    })
  );
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

/** Mounts usePick and returns the pick function. */
function mountPick(notify = vi.fn()) {
  let pick!: (g: Pick<GameDto, 'id' | 'week' | 'myPick'>, s: Side) => Promise<void>;
  function Probe() {
    pick = usePick(me, notify);
    return null;
  }
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>
    )
  );
  return { pick, notify };
}
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const listGame = () => qc.getQueryData<WeekDto>(keys.week(10))!.games[0];
const detailGame = () => qc.getQueryData<GameDetailDto>(keys.game('g1'))!;

describe('making a pick', () => {
  it('shows up right away in the list AND on the game page, before the server answers', async () => {
    const { pick } = mountPick();
    let done!: Promise<void>;
    await act(async () => {
      done = pick(game, 'home');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(calls).toContain('PUT /api/picks/g1');
    expect(listGame()).toMatchObject({ myPick: 'home', pickers: { away: ['Audrey'], home: ['Bea'] } });
    expect(detailGame()).toMatchObject({ myPick: 'home', waiting: ['Gwen'] });
    await act(async () => {
      resolvePick();
      await done;
    });
  });

  it('server accepts: refetches the week and the game page to confirm', async () => {
    const { pick, notify } = mountPick();
    await act(async () => {
      const p = pick(game, 'away');
      await new Promise((r) => setTimeout(r, 0));
      resolvePick();
      await p;
    });
    expect(notify).not.toHaveBeenCalled();
    expect(qc.getQueryState(keys.week(10))!.isInvalidated).toBe(true);
    expect(qc.getQueryState(keys.game('g1'))!.isInvalidated).toBe(true);
  });

  it('server rejects: everything is restored in both places, with its message', async () => {
    pickStatus = 409;
    const { pick, notify } = mountPick();
    await act(async () => {
      const p = pick(game, 'home');
      await new Promise((r) => setTimeout(r, 0));
      resolvePick();
      await p;
    });
    expect(notify).toHaveBeenCalledWith('Trop tard, le match a commencé.');
    expect(listGame()).toMatchObject({ myPick: null, pickers: { away: ['Audrey'], home: [] } });
    expect(detailGame()).toMatchObject({ myPick: null, waiting: ['Bea', 'Gwen'] });
  });

  it('same pick as before: nothing is sent', async () => {
    const { pick } = mountPick();
    await act(async () => pick({ ...game, myPick: 'away' }, 'away'));
    expect(calls).toEqual([]);
  });

  it('game page not opened yet: the list still updates', async () => {
    qc.removeQueries({ queryKey: keys.game('g1') });
    const { pick } = mountPick();
    await act(async () => {
      const p = pick(game, 'home');
      await new Promise((r) => setTimeout(r, 0));
      expect(listGame().myPick).toBe('home');
      resolvePick();
      await p;
    });
    expect(qc.getQueryData(keys.game('g1'))).toBeUndefined();
  });
});

describe('same data, a single request', () => {
  it('two components showing the same week request it only once', async () => {
    qc.clear();
    function Week() {
      useWeek(10);
      return null;
    }
    act(() =>
      root.render(
        <QueryClientProvider client={qc}>
          <Week />
          <Week />
        </QueryClientProvider>
      )
    );
    await flush();
    expect(calls.filter((c) => c === 'GET /api/weeks/10')).toHaveLength(1);
  });

  it('no known week: nothing is requested', async () => {
    qc.clear();
    function Week() {
      useWeek(undefined);
      return null;
    }
    act(() =>
      root.render(
        <QueryClientProvider client={qc}>
          <Week />
        </QueryClientProvider>
      )
    );
    await flush();
    expect(calls).toEqual([]);
  });
});
