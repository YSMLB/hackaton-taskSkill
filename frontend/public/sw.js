const CACHE_NAME = 'stepflow-offline-v2';
const OFFLINE_PATH = '/offline';
const assetPath = '/_next/static/';

async function prepareOffline() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(OFFLINE_PATH, { cache: 'reload' });
  if (!response.ok) throw new Error('Offline shell unavailable');
  const html = await response.clone().text();
  const urls = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map(match => match[1]))];
  if (!urls.length) throw new Error('Offline shell assets unavailable');
  await Promise.all(urls.map(async url => {
    const asset = await fetch(url);
    if (!asset.ok) throw new Error('Offline asset unavailable');
    await cache.put(url, asset);
  }));
  await cache.put(OFFLINE_PATH, response);
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
