/* Evisual service worker: funciona sin conexión y aplica actualizaciones al reiniciar.
   Para publicar una versión nueva: cambia VERSION aquí y "version" en version.json. */
const VERSION = '1.0.5';
const CACHE = 'evisual-' + VERSION;
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './vendor/pdf-lib.min.js',
  './vendor/fontkit.umd.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('evisual-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.pathname.endsWith('/version.json')) return; // siempre desde la red
  e.respondWith(caches.match(r, { ignoreSearch: r.mode === 'navigate' }).then(hit => hit || fetch(r).then(res => {
    if (res.ok && (u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname))) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy));
    }
    return res;
  }).catch(() => r.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
