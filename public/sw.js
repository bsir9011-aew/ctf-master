/* Install the complete hashed Vite build; never serve a stale HTML shell forever. */
const PREFIX='ctf-master-';
const CACHE=PREFIX+'v1.0.0';
const SHELL='/';
const OFFLINE_ASSETS=['/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const response=await fetch(SHELL,{cache:'reload'});
    if(!response.ok) throw new Error('App shell unavailable for offline precache');
    const html=await response.clone().text();
    const builtAssets=[...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(match=>match[1]);
    // An incomplete install cannot activate and replace the last working version.
    await Promise.all([cache.put(SHELL,response),...OFFLINE_ASSETS.concat(builtAssets).map(async url=>{
      const result=await fetch(url,{cache:'reload'});
      if(!result.ok) throw new Error('Cannot precache '+url);
      await cache.put(url,result);
    })]);
  })());
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith(PREFIX)&&name!==CACHE).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(req.mode==='navigate'){
      try {
        const fresh=await fetch(req);
        if(fresh.ok) await cache.put(SHELL,fresh.clone());
        return fresh;
      }catch {
        return (await cache.match(SHELL)) ?? Response.error();
      }
    }
    const cached=await cache.match(req);
    if(cached) return cached;
    try {
      const fresh=await fetch(req);
      if(fresh.ok && (new URL(req.url).pathname.startsWith('/assets/') ||
          ['/manifest.webmanifest','/icon-192.png','/icon-512.png'].includes(new URL(req.url).pathname))) {
        await cache.put(req,fresh.clone());
      }
      return fresh;
    }catch{return Response.error();}
  })());
});
