declare const __APP_VERSION__: string;

/** Version of the UI loaded on this phone (short commit hash). */
export const APP_VERSION = __APP_VERSION__;

/** Forces fetching the latest version: new service worker, caches cleared, reload. */
export async function reloadLatest() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
    await reg?.unregister();
  } finally {
    location.reload();
  }
}

/** An update should be offered: the server has another version, which the player hasn't already dismissed. */
export function needsUpdate(server: string | null, client: string, dismissed: string | null): boolean {
  return !!server && server !== client && server !== dismissed;
}

const DISMISSED_KEY = 'update-dismissed';

/** "Later": don't ask again for this version while the app stays open. */
export function dismissUpdate(server: string) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, server);
  } catch {
    /* no storage: we'll ask again */
  }
}

export function dismissedUpdate(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/** Version published on the server (null if unreachable). */
export async function serverVersion(): Promise<string | null> {
  try {
    const d = await fetch('/api/health', { cache: 'no-store' }).then((r) => r.json());
    return typeof d?.version === 'string' ? d.version : null;
  } catch {
    return null;
  }
}
