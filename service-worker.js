/* ================================================
   service-worker.js – PWA offline támogatás
   ================================================ */

const CACHE = 'jegyzetek-v1';
const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/firebase-config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Telepítés: előzetes gyorsítótárazás
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Aktiválás: régi cache törlése
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Kérés kezelés: cache-first (Firebase hálózaton marad)
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase és CDN kérések: csak hálózat
  if (url.includes('googleapis.com') ||
      url.includes('gstatic.com') ||
      url.includes('firebaseio.com') ||
      url.includes('firestore.googleapis.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request))
  );
});
