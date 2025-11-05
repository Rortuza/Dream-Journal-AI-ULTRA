const CACHE="dj-pro-v3";
const ASSETS=[
  "./","./index.html",
  "./style.css?v=100","./db.js?v=100","./crypto.js?v=100","./analysis.js?v=100","./ui.js?v=100","./app.js?v=100",
  "./manifest.json","./icon-192.png","./icon-512.png"
];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
});
self.addEventListener("fetch",e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=="GET"){ return; }
  e.respondWith(
    caches.match(e.request).then(hit=> hit || fetch(e.request).then(res=>{
      if(res.ok && (url.origin===location.origin)) {
        const copy = res.clone();
        caches.open(CACHE).then(c=> c.put(e.request, copy));
      }
      return res;
    }).catch(()=> caches.match("./index.html")))
  );
});
