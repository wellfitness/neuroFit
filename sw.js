const CACHE_NAME = 'kinesislab-cache-v10';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './assets/js/wake-lock.js',
  './assets/js/sw-updater.js',
  './assets/css/design-tokens.css',
  './src/herramientas/vanilla/dashboard.html',
  './src/herramientas/vanilla/css/dashboard.css',
  './src/herramientas/vanilla/css/tool-base.css',
  // Herramientas
  './src/herramientas/vanilla/tools/arrows/index.html',
  './src/herramientas/vanilla/tools/arrows/arrows.js',
  './src/herramientas/vanilla/tools/boxing/index.html',
  './src/herramientas/vanilla/tools/boxing/boxing.js',
  './src/herramientas/vanilla/tools/clock/index.html',
  './src/herramientas/vanilla/tools/clock/clock.js',
  './src/herramientas/vanilla/tools/colores/index.html',
  './src/herramientas/vanilla/tools/colores/colores.js',
  './src/herramientas/vanilla/tools/comba/index.html',
  './src/herramientas/vanilla/tools/comba/comba.js',
  './src/herramientas/vanilla/tools/d50/index.html',
  './src/herramientas/vanilla/tools/d50/d50.js',
  './src/herramientas/vanilla/tools/flechas/index.html',
  './src/herramientas/vanilla/tools/flechas/flechas.js',
  './src/herramientas/vanilla/tools/fluency/index.html',
  './src/herramientas/vanilla/tools/fluency/fluency.js',
  './src/herramientas/vanilla/tools/go-nogo/index.html',
  './src/herramientas/vanilla/tools/go-nogo/go-nogo.js',
  './src/herramientas/vanilla/tools/matrix/index.html',
  './src/herramientas/vanilla/tools/matrix/matrix.js',
  './src/herramientas/vanilla/tools/memoria/index.html',
  './src/herramientas/vanilla/tools/memoria/memoria.js',
  './src/herramientas/vanilla/tools/nback/index.html',
  './src/herramientas/vanilla/tools/nback/nback.js',
  './src/herramientas/vanilla/tools/reactive/index.html',
  './src/herramientas/vanilla/tools/reactive/reactive.js',
  './src/herramientas/vanilla/tools/search/index.html',
  './src/herramientas/vanilla/tools/search/search.js',
  './src/herramientas/vanilla/tools/simon/index.html',
  './src/herramientas/vanilla/tools/simon/simon.js',
  './src/herramientas/vanilla/tools/sonidos/index.html',
  './src/herramientas/vanilla/tools/sonidos/sonidos.js',
  './src/herramientas/vanilla/tools/sort/index.html',
  './src/herramientas/vanilla/tools/sort/sort.js',
  './src/herramientas/vanilla/tools/list-sorting/index.html',
  './src/herramientas/vanilla/tools/list-sorting/list-sorting.js',
  './src/herramientas/vanilla/tools/timers/index.html',
  './src/herramientas/vanilla/tools/timers/timers.js',
  './src/herramientas/vanilla/tools/trace/index.html',
  './src/herramientas/vanilla/tools/trace/trace.js',
  './src/herramientas/vanilla/tools/tracking/index.html',
  './src/herramientas/vanilla/tools/tracking/tracking.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
