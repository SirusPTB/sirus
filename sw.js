const SW_VERSION = '2026-01-14-18';
const CACHE_NAME = 'sirusptb-' + SW_VERSION;


const URLS_TO_CACHE = [
  './',
  'index.html',
  'main.html',
  'game.html',
  'setup.html',
  'latest_version.txt',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'favicon.ico'
];

console.log('SW VERSION', SW_VERSION);

// Install - cache files
self.addEventListener('install', event => {
  console.log('Service Worker installing...', SW_VERSION);
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Activate - clean old caches and take control
self.addEventListener('activate', event => {
  console.log('Service Worker activating...', SW_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      // Notify all clients to reload
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CACHE_UPDATED',
            version: SW_VERSION
          });
        });
      });
    })
  );
});

// Fetch - network first, then cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response before caching
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});