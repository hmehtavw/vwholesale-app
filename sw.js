// V Wholesale SW v24 — Pass-through only, no caching
const V = 'v24';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll().then(cs => cs.forEach(c => c.navigate(c.url))))
  );
});
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));
