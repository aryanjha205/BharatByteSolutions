const CACHE_NAME = 'bharatbyte-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/static/style.css',
  '/static/app.js',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/hero_poster.png',
  'https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;700;800&display=swap',
  'https://unpkg.com/mqtt/dist/mqtt.min.js'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching shell assets');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  // Limit caching to local origin and specific third-party CDN files
  const isLocalRequest = event.request.url.startsWith(self.location.origin);
  const isCdnRequest = event.request.url.startsWith('https://fonts.googleapis.com') ||
                       event.request.url.startsWith('https://fonts.gstatic.com') ||
                       event.request.url.startsWith('https://unpkg.com');

  if (!isLocalRequest && !isCdnRequest) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Stale-while-revalidate: return cached, update in background
          fetch(event.request).then(networkResponse => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
            }
          }).catch(() => { /* Ignore background fetch failures */ });
          return cachedResponse;
        }

        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        }).catch(err => {
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          throw err;
        });
      })
  );
});
