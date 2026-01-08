// sw.js
const CACHE_NAME = 'lvr1-cache-v1';

// Use relative paths (./) so it works in subfolders like /sirus/public/
const urlsToCache = [
  './',                  // Cache the current directory (helps with the root page)
  './index.html',
  './manifest.json',
  './DSEG7Classic-Bold.woff2',   // Uncomment once fonts are confirmed working
  './DSEG7Classic-Bold.woff',
  './DSEG7Classic-Bold.ttf',
  // Add icons if you have an 'icons' folder:
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.error('Failed to cache:', err);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(() => {
        // Optional: fallback page if offline and not in cache
        // return caches.match('./index.html');
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});