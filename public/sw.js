/**
 * Service Worker.
 * Стратегии:
 *   - /api/**            → только сеть, никогда не кэшируем (динамика).
 *   - навигация (HTML)   → network-first, офлайн-фолбэк на закэшированный '/'.
 *   - хешированные ассеты → cache-first (имя файла меняется при сборке, безопасно).
 *   - остальное          → network-first (нехешированные CSS/JS не залипают).
 * @fileoverview
 */

const CACHE_NAME = 'sportech-shell-v4';

const SHELL_URLS = ['/'];

// Иммутабельные бандлы вида main.a1b2c3d4.js / styles.deadbeef12.css
const IMMUTABLE_ASSET = /\.[0-9a-f]{8,}\.(js|css)$/;

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

  // Навигация и всё остальное: network-first с офлайн-фолбэком.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            // Навигацию всегда сохраняем под ключом '/' (единственная точка входа SPA).
            if (request.mode === 'navigate') {
              cache.put('/', copy);
            } else {
              // Остальные ресурсы (CSS, статика) — под их URL.
              cache.put(request, copy);
            }
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(c => c || caches.match('/'))
      )
  );
});
