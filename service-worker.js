/* ================================================
   service-worker.js – PWA offline támogatás
   FONTOS: HTML fájlok mindig hálózatból töltődnek,
   hogy a Firebase auth redirect működjön mobilon.
   ================================================ */

const CACHE = 'jegyzetek-v2';
const PRECACHE = [
  './css/style.css',
  './js/app.js',
  './js/firebase-config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase, Google, CDN kérések: csak hálózat
  if (url.includes('googleapis.com') ||
      url.includes('gstatic.com') ||
      url.includes('firebaseio.com') ||
      url.includes('firebaseapp.com') ||
      url.includes('accounts.google.com')) {
    return;
  }

  // HTML oldalak: MINDIG hálózatból (Firebase redirect auth miatt!)
  // Ha nincs net, akkor cache-ből
  if (e.request.mode === 'navigate' ||
      (e.request.method === 'GET' && e.request.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Egyéb statikus fájlok (CSS, JS, képek): cache-first
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request))
  );
});
