/**
 * Service Worker: предкэш оболочки + кэширование ресурсов с того же origin при первом успешном запросе.
 * @fileoverview
 */

const CACHE_NAME = 'sportech-shell-v1';
const SHELL_URLS = [
  '/index.html',
  '/static/css/global.css',
  '/static/js/main.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request)
        .then(response => {
          if (
            response.ok &&
            request.url.startsWith(self.location.origin) &&
            !request.url.includes('/node_modules/')
          ) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('/index.html')));
    })
  );
});
