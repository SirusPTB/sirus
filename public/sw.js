// sw.js - Improved Service Worker for LVR-1 PWA
// Features:
// - Precaches essential assets for fast loading and basic offline support
// - Clean old caches on activation
// - Immediate takeover of new version (skipWaiting + clients.claim)
// - Cache-first for assets, network-first with offline fallback for navigation
// - Supports update prompt from the page (send 'skipWaiting' message)
// - Easy to update: just bump CACHE_VERSION when deploying changes

const CACHE_VERSION = '2026-01-09-v1'; // Change this whenever you deploy new code
const CACHE_NAME = `lvr1-cache-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',                     // Root (important for GitHub Pages)
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png', // Add if you have a 512px icon
  '/apple-touch-icon.png',   // If you have one
  '/DSEG7Classic-Bold.woff2',
  '/DSEG7Classic-Bold.woff',
  '/DSEG7Classic-Bold.ttf',
  // Add any other static assets here (e.g., additional icons, sounds, etc.)
];

// Install: precache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()) // Activate new SW immediately
  );
});

// Activate: delete old caches and take control of clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('lvr1-cache-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
    .then(() => self.clients.claim()) // New SW controls pages instantly
  );
});

// Fetch: smart caching strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only cache same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navigation requests (HTML pages) → network first, fallback to index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Everything else (JS, CSS, fonts, icons) → cache first, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then(networkResponse => {
            // Cache successful network responses for next time
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return networkResponse;
          });
      })
  );
});

// Optional: Allow the page to trigger immediate update
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});