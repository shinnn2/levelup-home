const CACHE_NAME = 'levelup-home-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(['/', '/index.html', '/manifest.json'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).then((r) => { caches.open(CACHE_NAME).then((c) => c.put(e.request, r.clone())); return r; })
      .catch(() => caches.match(e.request))
  );
});
