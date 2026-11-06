const VERSION="0a7e7dd00735";
const SHELL='renfo-shell-'+VERSION,ASSETS='renfo-assets-'+VERSION;
const FILES=["./", "index.html", "css/app.css", "js/data.js", "js/core.js", "js/storage.js", "js/body.js", "js/app.js", "manifest.webmanifest", "assets/icon.svg", "assets/icon-192.png", "assets/icon-512.png"];
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES))));
// No skipWaiting: a session keeps its version until every open Renfo tab closes.
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('renfo-')&&k!==SHELL&&k!==ASSETS).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cached=await caches.match(req,{ignoreSearch:true});if(cached)return cached;
    try{const response=await fetch(req);if(response.ok&&/\.(webp|png|svg|pdf)$/.test(url.pathname)){const cache=await caches.open(ASSETS);await cache.put(req,response.clone());}return response;}
    catch(error){if(req.mode==='navigate'){const cache=await caches.open(SHELL);return await cache.match('index.html')||Response.error();}return Response.error();}
  })());
});
