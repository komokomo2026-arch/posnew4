/* EKAMBANI service worker.
   - Pages (HTML): network first, so an updated app is received as soon as the device is online; the cached copy is used offline.
   - Scripts, styles, fonts, images: cached on first use and refreshed in the background (stale-while-revalidate).
   - Never touched: Google sign-in, Google Drive / Apps Script (subscription, More module data) and any non-GET request, so
     authorization, backups and subscription checks always go straight to the network.
   Change CACHE_VERSION when files change so old caches are removed. */
const CACHE_VERSION = 'ekambani-v1';
const CORE = [
  './', 'index.html', 'Finance.html', 'Phone.html', 'More.html', 'Terms.html', 'Policy.html', 'About.html', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-48.png'
];
const NEVER_CACHE_HOSTS = ['script.google.com', 'script.googleusercontent.com', 'accounts.google.com', 'apis.google.com', 'www.googleapis.com', 'oauth2.googleapis.com', 'content.googleapis.com', 'www.google.com', 'wa.me', 'api.whatsapp.com'];

self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE_VERSION).then(function(cache) {
    return Promise.all(CORE.map(function(u) { return cache.add(new Request(u, { cache: 'reload' })).catch(function() { /* a missing optional file must not block installation */ }); }));
  }).then(function() { return self.skipWaiting(); }));
});
self.addEventListener('activate', function(event) {
  event.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k.indexOf('ekambani-') === 0 && k !== CACHE_VERSION; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});
self.addEventListener('message', function(event) { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });

function isHtml(request) {
  return request.mode === 'navigate' || request.destination === 'document' || request.destination === 'iframe' || (request.headers.get('accept') || '').indexOf('text/html') !== -1;
}
self.addEventListener('fetch', function(event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') return;
  if (NEVER_CACHE_HOSTS.indexOf(url.hostname) !== -1) return;
  if (req.headers.has('range')) return;
  const sameOrigin = url.origin === self.location.origin;
  if (isHtml(req) && sameOrigin) {
    event.respondWith(fetch(req).then(function(res) {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_VERSION).then(function(c) { c.put(req, copy); }); }
      return res;
    }).catch(function() {
      return caches.match(req, { ignoreSearch: true }).then(function(hit) { return hit || caches.match('index.html') || caches.match('./'); });
    }));
    return;
  }
  event.respondWith(caches.open(CACHE_VERSION).then(function(cache) {
    return cache.match(req).then(function(hit) {
      const net = fetch(req).then(function(res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function() { return hit; });
      return hit || net;
    });
  }));
});
