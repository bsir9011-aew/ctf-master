/* Install the complete hashed Vite build; work at / and /ctf-master/. */
const PREFIX = 'ctf-master-';
// A root-hosted app retains its historic cache name; project Pages caches are isolated.
const BASE = new URL('./', self.location.href ?? self.location.origin + '/sw.js').pathname;
const CACHE = PREFIX + 'v1.0.0-rc69' + (BASE === '/' ? '' : '-pages');
const SHELL = BASE;
const OFFLINE_ASSETS = [
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(SHELL, { cache: 'reload' });
    if (!response.ok) throw new Error('App shell unavailable for offline precache');
    const html = await response.clone().text();
    const builtAssets = [...html.matchAll(/(?:src|href)=["']([^"']*\/assets\/[^"']+)["']/g)]
      .map(match => new URL(match[1], self.location.origin).pathname);
    // An incomplete install cannot activate and replace the last working version.
    await Promise.all([
      cache.put(SHELL, response),
      ...OFFLINE_ASSETS.concat(builtAssets).map(async url => {
        const result = await fetch(url, { cache: 'reload' });
        if (!result.ok) throw new Error('Cannot precache ' + url);
        await cache.put(url, result);
      })
    ]);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      try {
        const fresh = await fetch(req);
        if (fresh.ok) await cache.put(SHELL, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(SHELL)) ?? Response.error();
      }
    }
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh.ok && (url.pathname.startsWith(BASE + 'assets/') ||
          OFFLINE_ASSETS.includes(url.pathname))) {
        await cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      return Response.error();
    }
  })());
});
