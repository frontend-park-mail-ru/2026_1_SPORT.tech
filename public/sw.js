/**
 * Service Worker.
 * Стратегии:
 *   - /api/**            → только сеть, никогда не кэшируем (динамика).
 *   - shell/ассеты сборки → precache при установке.
 *   - навигация (HTML)   → network-first, offline fallback на закэшированный '/'.
 *   - хешированные ассеты → cache-first (имя файла меняется при сборке, безопасно).
 *   - остальное          → network-first с fallback только на совпадающий cache key.
 * @fileoverview
 */

const CACHE_VERSION = 'dev'; // __CACHE_VERSION__
const CACHE_NAME = `sportech-shell-${CACHE_VERSION}`;
const PRECACHE_URLS = ['/']; // __PRECACHE_URLS__
const NAVIGATION_FALLBACK_URL = '/';

// Иммутабельные бандлы вида main.a1b2c3d4.js / styles.deadbeef12.css
const IMMUTABLE_ASSET = /\.[0-9a-f]{8,}\.(js|css)$/;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
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

  const url = new URL(request.url);

  // Чужой origin и API не трогаем — пусть идут в сеть как есть.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Иммутабельные ассеты: cache-first.
  if (IMMUTABLE_ASSET.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Навигация: network-first с fallback на SPA entrypoint.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(NAVIGATION_FALLBACK_URL, copy);
            });
          }
          return response;
        })
        .catch(() => caches.match(NAVIGATION_FALLBACK_URL).then(cached => cached || Response.error()))
    );
    return;
  }

  // Остальные same-origin ресурсы: network-first, но без подстановки HTML.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || Response.error()))
  );
});
