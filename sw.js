// V Wholesale Service Worker — Offline PWA Support
const CACHE_NAME = 'vwholesale-v20';
const OFFLINE_URLS = [
  '/vwholesale-app/',
  '/vwholesale-app/index.html',
  '/vwholesale-app/shop.html',
  '/vwholesale-app/about.html',
  '/vwholesale-app/contact.html',
  '/vwholesale-app/privacy.html',
  '/vwholesale-app/terms.html',
  '/vwholesale-app/refund.html',
  '/vwholesale-app/shipping.html',
  '/vwholesale-app/icon-192.png',
  '/vwholesale-app/icon-512.png',
  '/vwholesale-app/manifest.json',
];

// Install — cache core assets, skip waiting IMMEDIATELY
self.addEventListener('install', event => {
  self.skipWaiting(); // take over immediately, no waiting
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_URLS).catch(err => console.log('Cache error:', err));
    })
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network for Supabase API calls
  if (url.hostname.includes('supabase.co') || url.hostname.includes('anthropic.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'You are offline. Please reconnect.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Network first for everything else
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/vwholesale-app/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Background sync message
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// ── WEB PUSH NOTIFICATIONS ──────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'V Wholesale', body: 'You have a new notification' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch(e) {}

  const options = {
    body: data.body,
    icon: '/vwholesale-app/icon-192.png',
    badge: '/vwholesale-app/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'vw-push',
    requireInteraction: false,
    data: { url: data.url || '/vwholesale-app/' },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click — open the app at the right URL
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/vwholesale-app/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes('vwholesale-app') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
