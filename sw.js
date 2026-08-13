// V Wholesale SW v25 — Pass-through only, no caching.
// v24 used to force-reload every open tab the moment a new version
// activated (skipWaiting + clients.claim + navigate every client).
// That's what was silently kicking customers back to Home mid-browse
// any time a new deploy landed while they were on the site - this SPA
// never changes the URL, so any forced reload always lands on Home.
// Still clears old caches and takes control for *future* requests -
// just no longer yanks people out of whatever they're doing right now.
const V = 'v25';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
    .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));
