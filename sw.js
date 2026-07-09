// V Wholesale Service Worker v23 — Network First, No Stale Cache
const CACHE_NAME = 'vwholesale-v23';

// On install — skip waiting immediately
self.addEventListener('install', () => self.skipWaiting());

// On activate — delete ALL old caches and take control
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network First for HTML/JS, cache fallback for images only
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for HTML and JS — never serve stale
  if (event.request.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Images/icons — cache first
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return resp;
        });
      })
    );
    return;
  }

  // Everything else — network first
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
