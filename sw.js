const CACHE_NAME = 'prayer-tracker-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
  'https://cdn.tailwindcss.com/3.4.3',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Cache and return requests
self.addEventListener('fetch', event => {
  // Ignore non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // If the resource is in the cache, return it.
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache, try to fetch it from the network.
      return fetch(event.request).then(networkResponse => {
        // If the fetch is successful, clone it, cache it, and return it.
        return caches.open(CACHE_NAME).then(cache => {
          // We can only cache valid responses. Opaque responses are for third-party assets.
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      }).catch(error => {
        // If the fetch fails (e.g., user is offline), log the error but don't crash.
        // This allows the rest of the cached app to function.
        console.log('Fetch failed; user is likely offline.', event.request.url, error);
        // We could optionally return a fallback asset here if we had one.
      });
    })
  );
});

// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});