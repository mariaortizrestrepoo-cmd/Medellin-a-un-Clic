// Cambie este número cada vez que publique una versión nueva.
const VERSION = 'medellin-v157';
const BASE = VERSION + '-base';
const FOTOS = VERSION + '-fotos';
const FILES = ['./', './index.html', './manifest.json', './icon.svg', './portada.jpg', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(BASE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => !x.startsWith(VERSION)).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Las páginas: primero internet (para ver siempre la última versión); sin señal, la guardada.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    const esApp = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    const clave = esApp ? './index.html' : url.pathname;
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(BASE).then(c => c.put(clave, copia)); }
      return r;
    }).catch(() => caches.match(clave).then(r => r || caches.match('./index.html'))));
    return;
  }

  // Fotos y letras: la guardada al instante; si no está, se descarga y se guarda para usarla sin señal.
  const esFoto = url.origin === location.origin && /\.(jpe?g|png|webp|svg)$/i.test(url.pathname);
  const esLetra = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (esFoto || esLetra) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(FOTOS).then(c => c.put(req, copia)); }
      return res;
    })));
    return;
  }

  // Lo demás: lo guardado si existe, si no, internet.
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
