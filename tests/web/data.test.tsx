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
/** Réponse du serveur au prono, choisie par chaque test ; les relectures renvoient l'état « serveur ». */
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

/** Monte usePick et renvoie la fonction de prono. */
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

describe('faire un prono', () => {
  it('apparaît tout de suite dans la liste ET sur la fiche, avant la réponse du serveur', async () => {
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

  it('serveur d’accord : on relit la semaine et la fiche pour confirmer', async () => {
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

  it('serveur refuse : tout revient comme avant aux deux endroits, avec son message', async () => {
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

  it('même choix qu’avant : rien n’est envoyé', async () => {
    const { pick } = mountPick();
    await act(async () => pick({ ...game, myPick: 'away' }, 'away'));
    expect(calls).toEqual([]);
  });

  it('fiche pas encore ouverte : la liste se met à jour quand même', async () => {
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

describe('une même donnée, une seule requête', () => {
  it('deux composants qui affichent la même semaine ne la demandent qu’une fois', async () => {
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

  it('pas de semaine connue : rien n’est demandé', async () => {
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
