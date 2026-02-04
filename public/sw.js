// sw.js - Fixed paths for GitHub Pages subfolder hosting
// All precache paths are now RELATIVE (no leading '/') to match the service worker scope /sirus/public/
// This ensures fetches resolve correctly to /sirus/public/index.html, /sirus/public/manifest.json, etc.

const CACHE_VERSION = '2026-01-09-v10'; // Bumped again to force fresh cache
const CACHE_NAME = `lvr1-cache-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  'index.html',                    // Main page
  'manifest.json',
  'icons/icon-192x192.png',
  'DSEG7Classic-Bold.woff2',
  'DSEG7Classic-Bold.woff',
  'DSEG7Classic-Bold.ttf',
  // Optional: add these if they exist in your /public/ folder
  // 'favicon.ico',
  // 'apple-touch-icon.png',
];

// Helper: precache one-by-one (skips missing files gracefully)
async function precacheAssets() {
  const cache = await caches.open(CACHE_NAME);
  for (const relativePath of PRECACHE_ASSETS) {
    const url = new URL(relativePath, self.location).href; // Ensures correct full URL
    try {
      const response = await fetch(url, { cache: 'reload' });
      if (response && response.ok) {
        await cache.put(relativePath, response);
        console.log('Precaching succeeded:', relativePath);
      } else {
        console.warn('Skipping precache (not found/bad response):', relativePath);
      }
    } catch (err) {
      console.warn('Skipping precache (fetch error):', relativePath, err);
    }
  }
}

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    precacheAssets()
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
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

// Fetch: cache-first for assets, network-first for navigation with offline fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match('index.html')) // Extra offline safety
      )
  );
});

// Message for update prompt
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});