// Checkmate Country Club Yardage Book - Service Worker
// Caches the app shell so the book can be opened and used with no signal
// (e.g. out on the course). Firestore's own offline persistence handles
// the note/drawing data separately; this only covers the app itself.

const CACHE_VERSION = 'v2';
const CACHE_NAME = 'cmcc-ybk-' + CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

function isAppShellRequest(request) {
  const url = new URL(request.url);
  if (url.origin === self.location.origin) return true;
  if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') !== -1) return true;
  return false;
}

// Stale-while-revalidate: answer instantly from cache when possible (this is
// what makes the app open with no signal at all), while quietly refreshing
// the cache in the background whenever there IS a connection.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (!isAppShellRequest(request)) return; // let Firestore/API calls pass through untouched

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
