const SW_VERSION = '2026-06-08-01';
const CACHE_NAME = 'sirusptb-' + SW_VERSION;

// Keep this list small and only include files that definitely exist beside main.html.
// Optional files are attempted separately and will not break service-worker install if missing.
const REQUIRED_URLS = [
  './',
  './main.html',
  './manifest.json'
];

const OPTIONAL_URLS = [
  './favicon.ico',
  './sirusscreen1.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './index.html',
  './game.html',
  './setup.html',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

const NEVER_CACHE = [
  'latest_version.txt'
];

async function safeAdd(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload' });
    if (response && response.ok) {
      await cache.put(url, response);
    } else {
      console.warn('Not cached because it was not found or was not OK:', url, response && response.status);
    }
  } catch (err) {
    console.warn('Not cached because request failed:', url, err);
  }
}

self.addEventListener('install', event => {
  console.log('Service Worker installing...', SW_VERSION);
  self.skipWaiting();

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Do not use cache.addAll here. One 404 would reject the whole install.
    await Promise.all(REQUIRED_URLS.map(url => safeAdd(cache, url)));
    await Promise.all(OPTIONAL_URLS.map(url => safeAdd(cache, url)));
  })());
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...', SW_VERSION);

  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(cacheName => cacheName !== CACHE_NAME)
        .map(cacheName => caches.delete(cacheName))
    );

    await self.clients.claim();

    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_UPDATED',
        version: SW_VERSION
      });
    });
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  if (NEVER_CACHE.some(path => requestUrl.pathname.includes(path))) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(event.request);

      const isSameOrigin = requestUrl.origin === self.location.origin;
      const isChartJs = event.request.url.startsWith('https://cdn.jsdelivr.net/npm/chart.js');
      const isValidResponse = networkResponse && networkResponse.status === 200;

      if (isValidResponse && (isSameOrigin || isChartJs)) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, networkResponse.clone());
      }

      return networkResponse;
    } catch (err) {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;

      // If navigation fails offline, fall back to main.html if available.
      if (event.request.mode === 'navigate') {
        const appShell = await caches.match('./main.html');
        if (appShell) return appShell;
      }

      throw err;
    }
  })());
});
