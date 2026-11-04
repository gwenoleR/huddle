// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdateCheck } from '../../web/src/lib/useUpdateCheck';
import { dismissUpdate, dismissedUpdate, needsUpdate } from '../../web/src/lib/version';

vi.mock('../../web/src/lib/version', async (orig) => ({ ...(await orig<typeof import('../../web/src/lib/version')>()), reloadLatest: vi.fn() }));
// L'appli est en version « abc1234 » dans les tests (voir vitest.config.ts).
const { UpdatePrompt } = await import('../../web/src/screens/UpdatePrompt');
const version = await import('../../web/src/lib/version');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom n'ouvre pas vraiment les <dialog> : on fait le minimum.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open');
};

let serverVersion = 'abc1234';
const health = vi.fn(async () => new Response(JSON.stringify({ ok: true, version: serverVersion })));

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  sessionStorage.clear();
  serverVersion = 'abc1234';
  health.mockClear();
  vi.stubGlobal('fetch', health);
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
});

const flush = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});
function backToApp() {
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('faut-il proposer la mise à jour ?', () => {
  it('seulement si le serveur a une autre version, pas déjà repoussée', () => {
    expect(needsUpdate('def5678', 'abc1234', null)).toBe(true);
    expect(needsUpdate('abc1234', 'abc1234', null)).toBe(false);
    expect(needsUpdate('def5678', 'abc1234', 'def5678')).toBe(false); // « Plus tard » pour cette version
    expect(needsUpdate('9999999', 'abc1234', 'def5678')).toBe(true); // encore une nouvelle version
    expect(needsUpdate(null, 'abc1234', null)).toBe(false); // serveur injoignable
  });

  it('« Plus tard » est retenu le temps de la visite', () => {
    expect(dismissedUpdate()).toBeNull();
    dismissUpdate('def5678');
    expect(dismissedUpdate()).toBe('def5678');
  });
});

describe('vérification', () => {
  function Probe({ onResult }: { onResult: (v: string | null) => void }) {
    onResult(useUpdateCheck('abc1234').available);
    return null;
  }

  it('à l’ouverture puis au retour dans l’appli', async () => {
    let seen: string | null = null;
    act(() => root.render(<Probe onResult={(v) => (seen = v)} />));
    await flush();
    expect(health).toHaveBeenCalledTimes(1);
    expect(seen).toBeNull();

    serverVersion = 'def5678'; // le serveur vient d'être mis à jour
    backToApp();
    await flush();
    expect(health).toHaveBeenCalledTimes(2);
    expect(seen).toBe('def5678');
  });

  it('serveur injoignable : rien à proposer, pas d’erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    let seen: string | null = 'x';
    act(() => root.render(<Probe onResult={(v) => (seen = v)} />));
    await flush();
    expect(seen).toBeNull();
  });
});

describe('feuille « Nouvelle version »', () => {
  const dialog = () => el.querySelector('dialog')!;
  const button = (label: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === label)!;

  it('reste fermée quand l’appli est à jour', async () => {
    act(() => root.render(<UpdatePrompt />));
    await flush();
    expect(dialog().open).toBe(false);
  });

  it('s’ouvre quand le serveur a une nouvelle version, et « Mettre à jour » recharge', async () => {
    serverVersion = 'def5678';
    act(() => root.render(<UpdatePrompt />));
    await flush();
    expect(dialog().open).toBe(true);
    act(() => button('Mettre à jour').click());
    expect(version.reloadLatest).toHaveBeenCalled();
  });

  it('« Plus tard » ferme et ne redemande pas pour cette version', async () => {
    serverVersion = 'def5678';
    act(() => root.render(<UpdatePrompt />));
    await flush();
    act(() => button('Plus tard').click());
    expect(dialog().open).toBe(false);
    backToApp();
    await flush();
    expect(dialog().open).toBe(false);

    serverVersion = '9999999'; // encore une autre mise à jour : on repropose
    backToApp();
    await flush();
    expect(dialog().open).toBe(true);
  });
});
