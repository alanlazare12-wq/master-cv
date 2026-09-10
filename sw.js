const CACHE='hoja-personal-v48-mcp20';
const cachePutQuietly=(key,response)=>caches.open(CACHE).then(c=>c.put(key,response)).catch(()=>{});
const FILES=['./','./index.html','./styles.css?v=48-mcp20','./src/app.js?v=48-mcp20','./src/schema.js?v=48','./src/storage.js?v=48','./src/section-catalog.js?v=48','./src/ats-engine.js?v=48','./src/job-engine.js?v=48','./src/exporters.js?v=48','./src/personal-templates.js?v=48','./src/template-engine-base.js?v=48','./src/studio-engine.js?v=48','./src/studio-pro.js?v=48','./src/local-pro.js?v=48','./src/local-premium.js?v=48','./src/template-forge.js?v=48','./src/local-ai.js?v=48-mcp20','./src/chatgpt-bridge.js?v=48-mcp20','./src/resume-intelligence.js?v=48-mcp20','./src/export-document.js?v=48-mcp20','./src/resume-workbench.js?v=48','./src/version.js?v=48','./src/career-pack.js?v=48','./src/evidence.js?v=48','./src/page-tools.js?v=48','./src/durable-store.js?v=48','./src/tab-sync.js?v=48','./src/conflict-resolver.js?v=48','./manifest.webmanifest?v=48-mcp20'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(xs=>Promise.all(xs.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/')){e.respondWith(fetch(req));return}
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(r=>{if(r.ok)void cachePutQuietly('./index.html',r.clone());return r}).catch(()=>caches.match('./index.html')));return;
  }
  e.respondWith(caches.match(req).then(cached=>{
    const network=fetch(req).then(r=>{if(r.ok)void cachePutQuietly(req,r.clone());return r});
    if(cached){void network.catch(()=>{});return cached}
    return network;
  }));
});
