/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { DEFAULT_LANG, messages } from '../../shared/i18n';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

// The app itself: cached at install time, so it opens even without a network.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/logos\//] }));

// Logos: served from the cache, refreshed in the background.
registerRoute(({ url }) => url.pathname.startsWith('/logos/'), new StaleWhileRevalidate({ cacheName: 'logos' }));

// Data: network first, last known state if the network doesn't answer.
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({ cacheName: 'api', networkTimeoutSeconds: 4 })
);

self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// The server always sends a title (the instance name); the service worker doesn't read the instance
// settings, hence this short default name.
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? messages(DEFAULT_LANG).common.appShortName, {
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
