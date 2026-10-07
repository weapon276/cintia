/* ============================================
   SERVICE WORKER — GDL Cultural PWA
   CRÍTICO: Android Chrome requiere un handler 'fetch' para instalabilidad
   ============================================ */
const CACHE_NAME = 'gdl-cultural-v4';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];

/* ------------------------------------------
   Helper: ¿es una petición cacheable?
   ------------------------------------------ */
function isCacheable(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('ticketmaster.com') ||
      url.hostname.includes('apify.com')) return false;
  return true;
}

/* ------------------------------------------
   INSTALL
   ------------------------------------------ */
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        SHELL_ASSETS.map(asset => cache.add(asset).catch(err => console.warn('[SW] No cache:', asset)))
      ))
      .then(() => self.skipWaiting())
  );
});

/* ------------------------------------------
   ACTIVATE
   ------------------------------------------ */
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ------------------------------------------
   FETCH — CRÍTICO para Android PWA installability
   Sin este handler, Android Chrome NO permite instalar la PWA
   ------------------------------------------ */
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Ignorar esquemas no soportados (chrome-extension, etc.)
  if (!isCacheable(request)) {
    return; // Dejar que el navegador maneje
  }
  
  // Navegación (HTML): Network First
  if (request.mode === 'navigate' ||
      (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('/index.html')))
    );
    return;
  }
  
  // Otros assets: Cache First con revalidación
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        fetch(request).then(response => {
          if (response && response.status === 200 && isCacheable(request)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(() => {});
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then(response => {
        if (response && response.status === 200 && isCacheable(request)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(() => {});
        }
        return response;
      }).catch(() => new Response('', { status: 404 }));
    })
  );
});

/* ------------------------------------------
   MENSAJES
   ------------------------------------------ */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
