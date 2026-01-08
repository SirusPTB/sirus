// sw.js
const CACHE_NAME = 'lvr1-cache-v1';

// Use relative paths (./) so it works in subfolders like /sirus/public/
const urlsToCache = [
  './',                  // Cache the current directory (helps with the root page)
  './index.html',
  './manifest.json',
  // './DSEG7Classic-Bold.woff2',   // Uncomment once fonts are confirmed working
  // './DSEG7Classic-Bold.woff',
  // './DSEG7Classic-Bold.ttf'
  // Add icons if you have an 'icons' folder:
  // './icons/icon-192x192.png',
  // './icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => {
      return resp || fetch(event.request);
    })
  );
});