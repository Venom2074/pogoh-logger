const CACHE = 'pogoh-companion-v7';
const SHELL = ['./','index.html','styles.css','app.mjs','core.mjs','route-utils.mjs','navigation.mjs','navigation-ui.mjs','updates.mjs','library.mjs','routes.json','routes/schenley.gpx','routes/eliza.gpx','routes/river-loop.gpx','routes/eliza-quick.gpx','routes/south-side.gpx','routes/north-shore.gpx','routes/junction-hollow.gpx','routes/stadium-trail.gpx','routes/hot-metal-gap.gpx','routes/hazelwood-green.gpx','icon.svg','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png','manifest.webmanifest','vendor/leaflet.js','vendor/leaflet.css','data/summary.json'];
self.addEventListener('message',event => {
  if(event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('install',event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate',event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('pogoh-companion-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch',event => {
  const url = new URL(event.request.url);
  // Never cache live feeds or third-party tiles. Offline values are always dated.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./',self.location).pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {const copy = response.clone();event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request,copy)));}
    return response;
  }).catch(async () => (await caches.match(event.request)) || Response.error()));
});
