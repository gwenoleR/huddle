// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Admin } from '../../web/src/screens/Admin';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Fake server: just what the admin page reads on load. */
const fetchMock = vi.fn(async (url: string) => {
  if (url === '/api/admin/players')
    return new Response(
      JSON.stringify([
        { id: 1, name: 'Léa', startPoints: 0, isAdmin: true, hasPin: true },
        { id: 2, name: 'Tom', startPoints: 5, isAdmin: false, hasPin: false }
      ])
    );
  if (url === '/api/admin/bonus') return new Response(JSON.stringify({ enabled: false, points: { afc: 3, nfc: 3, sb: 5 }, reveal: 'wildcard' }));
  if (url === '/api/admin/sync') return new Response(JSON.stringify({ at: null, ok: true, message: '', games: 272 }));
  throw new Error(`unexpected call ${url}`);
});

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
});

async function render(isAdmin: boolean) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <Admin me={{ id: 1, name: 'Léa', isAdmin }} notify={() => {}} />
      </QueryClientProvider>
    )
  );
  await act(async () => {});
}

describe('Admin page', () => {
  it('three sections: players, season, data', async () => {
    await render(true);
    const titles = [...el.querySelectorAll('.section-title')].map((h) => h.textContent);
    expect(titles).toEqual(['Joueurs · 2', 'Saison', 'Données']);
    expect(el.textContent).toContain('pas encore connecté · 5 pts de départ');
    expect(el.textContent).toContain('Importer l’historique');
  });

  it('not admin: nothing to see, no call to the admin API', async () => {
    await render(false);
    expect(el.textContent).toContain('Réservé aux admins');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
