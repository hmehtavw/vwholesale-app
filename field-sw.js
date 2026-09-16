// V Wholesale Field — Service Worker
// Caches the app shell so it works offline and survives browser cache clears
// Session data stays in localStorage (separate from browser cache)

const CACHE_NAME = 'vw-field-v4';
const APP_SHELL = [
  '/field.html',
  '/field-manifest.json',
];

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first for API calls, cache first for app shell
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for Supabase API and edge functions
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('graph.facebook.com')) {
    return; // Let it go to network directly
  }

  // For the app shell: serve from cache, update in background
  if (APP_SHELL.some(path => url.pathname.endsWith(path.replace('/', '')))) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(response => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(() => cached);
        // Return cached immediately, update in background
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else: network first
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
