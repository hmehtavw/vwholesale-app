// V Wholesale Field — Service Worker v5
// Handles background location pings via periodic background sync

const CACHE_NAME = 'vw-field-v5';
const APP_SHELL = ['/field.html', '/field-manifest.json'];

// Install
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — serve app shell from cache
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com')) return;
  if (APP_SHELL.some(p => url.pathname.endsWith(p.replace('/',\'\')))) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});

// Background location ping via message from page
self.addEventListener('message', async e => {
  if (e.data?.type === 'LOCATION_PING') {
    const { staffId, lat, lng, accuracy, speed, isMoving, anonKey, supabaseUrl, attendanceId, city } = e.data;
    try {
      await fetch(`${supabaseUrl}/rest/v1/field_location_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          staff_id: staffId, lat, lng, accuracy_m: accuracy,
          speed_kmh: speed, is_moving: isMoving,
          recorded_at: new Date().toISOString(),
          city: city || \'Vijayawada\',
          attendance_id: attendanceId || null
        })
      });
    } catch(e) { /* silently fail */ }
  }
});

// Periodic background sync (Chrome Android only — best effort)
self.addEventListener('periodicsync', e => {
  if (e.tag === \'field-location\') {
    e.waitUntil(
      // Ask all open clients to send their location
      self.clients.matchAll({ type: \'window\' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: \'REQUEST_LOCATION\' }));
      })
    );
  }
});
