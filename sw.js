/* sw.js — Service Worker for LightGate PWA */

const CACHE_NAME = 'lightgate-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/browser.css',
  '/css/themes.css',
  '/js/app.js',
  '/js/bookmarks.js',
  '/js/history.js',
  '/js/settings.js',
  '/pages/newtab.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/* ─── Install: cache app shell ─────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* ─── Activate: clean up old caches ────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ─── Fetch: serve from cache, fallback to network ─────── */
self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin resources (app shell)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For cross-origin requests (iframes loading external sites), let them pass through
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses for app shell resources
        if (response && response.status === 200 && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback for HTML navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
