// sw.js - Improved and Robust Service Worker for LVR-1 PWA
// Fixed: Handles missing assets gracefully (skips failed fetches during precache)
// Features remain the same: fast updates, clean caches, offline support, update prompt ready

const CACHE_VERSION = '2026-01-09-v2'; // Bumped version to force fresh install
const CACHE_NAME = `lvr1-cache-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',                        // Root (serves index.html on GitHub Pages)
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',  // Confirmed from your HTML
  // Fonts used in your CSS (assuming they are in root)
  '/DSEG7Classic-Bold.woff2',
  '/DSEG7Classic-Bold.woff',
  '/DSEG7Classic-Bold.ttf',
  // Add more confirmed files here if needed (e.g., '/favicon.ico' if exists)
];

// Helper: precache assets one-by-one to skip any 404/missing files
async function precacheAssets() {
  const cache = await caches.open(CACHE_NAME);
  for (const url of PRECACHE_ASSETS) {
    try {
      const response = await fetch(url, { cache: 'reload' }); // Force fresh fetch
      if (response && response.ok) {
        await cache.put(url, response);
        console.log('Precaching succeeded:', url);
      } else {
        console.warn('Skipping precache (not found or bad response):', url);
      }
    } catch (err) {
      console.warn('Skipping precache (fetch failed):', url, err);
    }
  }
}

// Install: precache core assets (tolerant to missing files)
self.addEventListener('install', event => {
  event.waitUntil(
    precacheAssets()
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches + immediate control
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('lvr1-cache-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch: same smart strategies
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => caches.match('/index.html')); // Offline fallback
      })
  );
});

// Message: allow page to trigger update
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});