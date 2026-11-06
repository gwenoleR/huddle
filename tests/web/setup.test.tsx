// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from '../../web/src/screens/Login';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Serveur simulé : la liste des joueurs, puis la création du groupe et /me. */
let players: object[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === '/api/players') return new Response(JSON.stringify(players));
  if (url === '/api/setup') return new Response(JSON.stringify({ ok: true, created: true }));
  if (url === '/api/me') return new Response(JSON.stringify({ id: 1, name: 'Léa', isAdmin: true }));
  throw new Error(`appel inattendu ${init?.method ?? 'GET'} ${url}`);
});

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.useRealTimers();
});

const flush = () => act(async () => void (await vi.runAllTimersAsync()));
const button = (text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === text)!;
async function typePin(pin: string) {
  for (const d of pin) act(() => button(d).click());
  await flush();
}

describe('nouvelle installation', () => {
  it('base vide : on crée le groupe avec son prénom et son code', async () => {
    players = [];
    const onLogged = vi.fn();
    act(() => root.render(<Login onLogged={onLogged} />));
    await flush();
    expect(el.textContent).toContain('Crée ton groupe');

    const input = el.querySelector<HTMLInputElement>('#setup-name')!;
    act(() => {
      // React suit la valeur par son setter natif : on passe par lui, comme le navigateur.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '  Léa ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => button('Continuer').click());
    expect(el.textContent).toContain('Choisis ton code');

    await typePin('4321');
    expect(el.textContent).toContain('Confirme ton code');
    await typePin('4321');

    const setup = fetchMock.mock.calls.find(([url]) => url === '/api/setup')!;
    expect(JSON.parse(setup[1]!.body as string)).toEqual({ name: 'Léa', pin: '4321' });
    expect(onLogged).toHaveBeenCalledWith({ id: 1, name: 'Léa', isAdmin: true });
  });

  it('groupe déjà créé : la liste des joueurs, pas de création', async () => {
    players = [{ id: 1, name: 'Léa', hasPin: true }];
    act(() => root.render(<Login onLogged={() => {}} />));
    await flush();
    expect(el.textContent).toContain('Qui es-tu ?');
    expect(el.textContent).not.toContain('Crée ton groupe');
  });
});
