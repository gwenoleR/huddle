/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

// L'appli elle-même : mise en cache à l'installation, donc elle s'ouvre même sans réseau.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/logos\//] }));

// Logos : servis depuis le cache, rafraîchis en arrière-plan.
registerRoute(({ url }) => url.pathname.startsWith('/logos/'), new StaleWhileRevalidate({ cacheName: 'logos' }));

// Données : réseau d'abord, dernier état connu si le réseau ne répond pas.
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({ cacheName: 'api', networkTimeoutSeconds: 4 })
);

self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Prono', {
      body: data.body,
      tag: data.tag,
      data: { url: data.url ?? '/' },
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url: string = event.notification.data?.url ?? '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await (client as WindowClient).navigate(url).catch(() => undefined);
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
