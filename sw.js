// Trading Journal — Service Worker
// Caches the app shell so the journal opens even with no connection.
// Data sync (Supabase) is handled separately in index.html via an IndexedDB outbox —
// this worker does NOT do background sync, since Background Sync API isn't
// supported in Safari/iOS. Offline writes are queued and flushed by the page itself
// the moment it detects it's back online.

const CACHE_NAME = 'tj-shell-v1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls (Forex Factory, formatter, Supabase) — always go to network
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return; // let it hit the network normally
  }

  // App shell: cache-first, falling back to network, falling back to cached index.html
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          // Cache successful same-origin GET responses for next time offline
          if (event.request.method === 'GET' && res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});
