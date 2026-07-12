/* SnapVidly service worker — installable PWA + offline shell.
   Bump CACHE on any release so old caches are purged (activate step). */
const CACHE = 'snapvidly-v4';
const SHELL = ['/', '/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ads, platform CDNs — untouched
  if (url.pathname.startsWith('/api/')) return; // never cache the API

  // IMPORTANT: do NOT intercept build assets. Hashed /_next/ chunks are handled by
  // the browser HTTP cache + Nginx immutable cache. Caching them in the SW risks
  // serving a stale chunk after a deploy → ChunkLoadError. Let them pass through.
  if (url.pathname.startsWith('/_next/')) return;

  // Navigations: network-first (always fresh HTML → no stale chunk refs),
  // fall back to cache, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/offline'))),
    );
  }
  // Everything else (fonts, images, etc.): let the browser handle it normally.
});
