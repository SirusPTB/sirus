console.log('SW VERSION 2026-02-14-01');

const CACHE_NAME = 'sirusptb-v4';

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
];

// Install
self.addEventListener('install', event => {
  self.skipWaiting(); // force install immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )
      ),
      self.clients.claim() //  take control immediately
    ])
  );
});

// Fetch (network-first)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache =>
          cache.put(event.request, copy)
        );
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});