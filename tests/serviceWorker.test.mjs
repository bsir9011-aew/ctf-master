import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const workerSource=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function mockWorker() {
  const handlers={};
  const data=new Map();
  const resources={
    '/':'<html><head><link rel="stylesheet" href="/assets/index-a.css"></head><body><script type="module" src="/assets/index-a.js"></script></body></html>',
    '/index.html':'<html>index</html>',
    '/manifest.webmanifest':'{}',
    '/icon-192.png':'icon192',
    '/icon-512.png':'icon512',
    '/assets/index-a.css':'body{color:white}',
    '/assets/index-a.js':'console.log("ok")'
  };
  let online=true;
  const caches={
    async open(name) {
      if(!data.has(name)) data.set(name,new Map());
      const items=data.get(name);
      return {
        async put(key,response){items.set(typeof key==='string'?key:key.url,response.clone());},
        async match(key){return items.get(typeof key==='string'?key:key.url)?.clone();}
      };
    },
    async keys(){return [...data.keys()];},
    async delete(name){return data.delete(name);}
  };
  async function fetchMock(input) {
    if(!online) throw Error('network unavailable');
    const path=typeof input==='string' ? input :
      input.mode==='navigate' ? '/' : new URL(input.url).pathname;
    if(!(path in resources)) return new Response('not found',{status:404});
    return new Response(resources[path],{status:200});
  }
  const self={
    location:{origin:'https://ctf.test'},
    clients:{claim:async()=>{}},
    addEventListener(type,fn){handlers[type]=fn;},
    skipWaiting(){}
  };
  vm.runInNewContext(workerSource,{self,caches,fetch:fetchMock,Response,URL,Promise});
  const dispatch=async (type,request) => {
    let pending=null;
    handlers[type]({request,waitUntil(p){pending=p;},respondWith(p){pending=p;}});
    return pending ? await pending : undefined;
  };
  return {caches,resources,data,dispatch,setOnline:(value)=>{online=value;}};
}

test('worker precaches the hashed JS/CSS and standalone shell',async()=>{
  const sw=mockWorker();
  await sw.dispatch('install');
  const names=await sw.caches.keys();
  assert.deepEqual(names,['ctf-master-v1.0.0']);
  const cache=await sw.caches.open(names[0]);
  for(const path of ['/','/assets/index-a.js','/assets/index-a.css','/manifest.webmanifest','/icon-192.png']) {
    assert.ok(await cache.match(path),path);
  }
});

test('online navigation refreshes shell while offline navigation serves cached shell',async()=>{
  const sw=mockWorker();
  await sw.dispatch('install');
  sw.resources['/']='<html>new-version-from-network</html>';
  const request={method:'GET',url:'https://ctf.test/mission',mode:'navigate'};
  const fresh=await sw.dispatch('fetch',request);
  assert.match(await fresh.text(),/new-version-from-network/);
  sw.setOnline(false);
  const offline=await sw.dispatch('fetch',request);
  assert.match(await offline.text(),/new-version-from-network/);
});

test('activation deletes only stale CTF Master caches, not other apps caches',async()=>{
  const sw=mockWorker();
  await sw.caches.open('ctf-master-v0.1.0');
  await sw.caches.open('another-pwa');
  await sw.dispatch('install');
  await sw.dispatch('activate');
  const names=await sw.caches.keys();
  assert.equal(names.includes('ctf-master-v0.1.0'),false);
  assert.equal(names.includes('ctf-master-v1.0.0'),true);
  assert.equal(names.includes('another-pwa'),true);
});
