/**
 * Service Worker: предкэш оболочки + кэширование ресурсов с того же origin при первом успешном запросе.
 * @fileoverview
 */

const CACHE_NAME = 'sportech-shell-v2';

// Кешируем только index.html — всё остальное (JS/CSS с хешами) попадёт
// в кеш автоматически через fetch-handler при первом открытии страницы.
const SHELL_URLS = ['/'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
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
