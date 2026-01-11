const CACHE_NAME = 'sirusptb-v1';

const URLS_TO_CACHE = [
  './',
  'index.html',
  'main.html',
  'game.html',
  'latest_version.txt',
  'https://cdn.jsdelivr.net/npm/chart.js',  // Enables charts offline
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'favicon.ico'
  // Add 'setup.html' if you have it
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});