// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdateCheck } from '../../web/src/lib/useUpdateCheck';
import { dismissUpdate, dismissedUpdate, needsUpdate } from '../../web/src/lib/version';

vi.mock('../../web/src/lib/version', async (orig) => ({ ...(await orig<typeof import('../../web/src/lib/version')>()), reloadLatest: vi.fn() }));
// The app is at version "abc1234" in tests (see vitest.config.ts).
const { UpdatePrompt } = await import('../../web/src/screens/UpdatePrompt');
const version = await import('../../web/src/lib/version');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom doesn't really open <dialog>s: do the bare minimum.
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

describe('should the update be offered?', () => {
  it('only if the server has another version, not already dismissed', () => {
    expect(needsUpdate('def5678', 'abc1234', null)).toBe(true);
    expect(needsUpdate('abc1234', 'abc1234', null)).toBe(false);
    expect(needsUpdate('def5678', 'abc1234', 'def5678')).toBe(false); // "Later" for this version
    expect(needsUpdate('9999999', 'abc1234', 'def5678')).toBe(true); // yet another new version
    expect(needsUpdate(null, 'abc1234', null)).toBe(false); // server unreachable
  });

  it('"Later" is remembered for the visit', () => {
    expect(dismissedUpdate()).toBeNull();
    dismissUpdate('def5678');
    expect(dismissedUpdate()).toBe('def5678');
  });
});

describe('check', () => {
  function Probe({ onResult }: { onResult: (v: string | null) => void }) {
    onResult(useUpdateCheck('abc1234').available);
    return null;
  }

  it('on open, then when coming back to the app', async () => {
    let seen: string | null = null;
    act(() => root.render(<Probe onResult={(v) => (seen = v)} />));
    await flush();
    expect(health).toHaveBeenCalledTimes(1);
    expect(seen).toBeNull();

    serverVersion = 'def5678'; // the server was just updated
    backToApp();
    await flush();
    expect(health).toHaveBeenCalledTimes(2);
    expect(seen).toBe('def5678');
  });

  it('server unreachable: nothing to offer, no error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    let seen: string | null = 'x';
    act(() => root.render(<Probe onResult={(v) => (seen = v)} />));
    await flush();
    expect(seen).toBeNull();
  });
});

describe('"New version" sheet', () => {
  const dialog = () => el.querySelector('dialog')!;
  const button = (label: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === label)!;

  it('stays closed when the app is up to date', async () => {
    act(() => root.render(<UpdatePrompt />));
    await flush();
    expect(dialog().open).toBe(false);
  });

  it('opens when the server has a new version, and "Update" reloads', async () => {
    serverVersion = 'def5678';
    act(() => root.render(<UpdatePrompt />));
    await flush();
    expect(dialog().open).toBe(true);
    act(() => button('Mettre à jour').click());
    expect(version.reloadLatest).toHaveBeenCalled();
  });

  it('"Later" closes and does not ask again for this version', async () => {
    serverVersion = 'def5678';
    act(() => root.render(<UpdatePrompt />));
    await flush();
    act(() => button('Plus tard').click());
    expect(dialog().open).toBe(false);
    backToApp();
    await flush();
    expect(dialog().open).toBe(false);

    serverVersion = '9999999'; // yet another update: offered again
    backToApp();
    await flush();
    expect(dialog().open).toBe(true);
  });
});
