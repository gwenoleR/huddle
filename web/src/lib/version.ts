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
