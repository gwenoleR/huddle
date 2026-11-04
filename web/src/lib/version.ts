declare const __APP_VERSION__: string;

/** Version de l'interface chargée sur ce téléphone (hash court du commit). */
export const APP_VERSION = __APP_VERSION__;

/** Force la récupération de la dernière version : nouveau service worker, caches vidés, rechargement. */
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

/** Une mise à jour est à proposer : le serveur a une autre version, que le joueur n'a pas déjà repoussée. */
export function needsUpdate(server: string | null, client: string, dismissed: string | null): boolean {
  return !!server && server !== client && server !== dismissed;
}

const DISMISSED_KEY = 'update-dismissed';

/** « Plus tard » : on ne redemande pas pour cette version tant que l'appli reste ouverte. */
export function dismissUpdate(server: string) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, server);
  } catch {
    /* pas de stockage : on redemandera */
  }
}

export function dismissedUpdate(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/** Version publiée sur le serveur (null si injoignable). */
export async function serverVersion(): Promise<string | null> {
  try {
    const d = await fetch('/api/health', { cache: 'no-store' }).then((r) => r.json());
    return typeof d?.version === 'string' ? d.version : null;
  } catch {
    return null;
  }
}
