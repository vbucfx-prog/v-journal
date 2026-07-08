// Trading Journal — Service Worker
// Caches the app shell so the journal opens even with no connection.
// Data sync (Supabase) is handled separately in index.html via an IndexedDB outbox —
// this worker does NOT do background sync, since Background Sync API isn't
// supported in Safari/iOS. Offline writes are queued and flushed by the page itself
// the moment it detects it's back online.

// Bump this version any time index.html changes in a way you need to force-refresh
// on devices that already have the old version cached.
const CACHE_NAME = 'tj-shell-v2';
const SHELL_FILES = [
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

  const isDocument = event.request.mode === 'navigate' ||
    url.pathname === '/' || url.pathname.endsWith('/index.html');

  if (isDocument) {
    // NETWORK-FIRST for the app itself: always try to get the latest version.
    // Only fall back to the cached copy if there's genuinely no connection —
    // this is what makes "update the file → redeploy → reload" actually work,
    // instead of the phone getting stuck on whatever was cached first.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Static assets (icons, manifest): cache-first is fine, they rarely change
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          if (event.request.method === 'GET' && res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
