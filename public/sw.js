// public/sw.js

const CACHE_STATIC = 'sportech-static-v2';
const CACHE_API = 'sportech-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_STATIC && key !== CACHE_API)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Статика – Cache First
  if (!url.pathname.startsWith('/api')) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // GET-запросы к API: Stale‑While‑Revalidate
  if (request.method === 'GET') {
    event.respondWith(staleWhileRevalidate(request, CACHE_API));
    return;
  }

  // Остальные методы (POST, PATCH, DELETE) – только сеть
  event.respondWith(networkOnly(request));
});

// --- стратегии ---

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.headers.get('Accept')?.includes('text/html')) {
      return caches.match('/index.html');
    }
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Фоновая попытка обновить кэш (не ждём её)
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => {});

  // Если кэш есть – возвращаем его немедленно
  if (cached) {
    // Не ждём завершения fetchPromise
    return cached;
  }

  // Кэша нет – ждём сеть
  return fetchPromise;
}

async function networkOnly(request) {
  return fetch(request);
}
