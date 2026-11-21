const CACHE_NAME = 'stepflow-offline-v4';
const OFFLINE_PATH = '/offline-reader.html';
const assetPath = '/_next/static/';

async function prepareOffline() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll([OFFLINE_PATH, '/offline-reader.js', '/offline-example.json'].map(path => new Request(path, { cache: 'reload' })));
}

self.addEventListener('install', event => {
  event.waitUntil(prepareOffline().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('stepflow-offline-') && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data !== 'prepare-offline' || !event.ports[0]) return;
  event.waitUntil(prepareOffline().then(
    () => event.ports[0].postMessage('ready'),
    () => event.ports[0].postMessage('error'),
  ));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (['/offline-reader.js', '/offline-example.json'].includes(url.pathname)) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => await cache.match(request) || fetch(request)));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(OFFLINE_PATH, { ignoreVary: true }) || Response.error();
    }));
    return;
  }
  if (url.pathname.startsWith(assetPath)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return await cache.match(request, { ignoreVary: true }) || Response.error();
      }
    })());
  }
});
