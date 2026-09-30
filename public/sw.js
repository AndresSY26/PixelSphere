
/**
 * PIXELSPHERE SERVICE WORKER v1.5
 * Requisito crítico para habilitar la instalación nativa en el navegador.
 */

const CACHE_NAME = 'pixelsphere-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.webmanifest',
];

// Instalación: Preparar caché base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activación: Tomar control del nodo
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// EVENTO FETCH: CRÍTICO PARA LA INSTALABILIDAD
// Sin este evento, el navegador no considera la app como instalable.
self.addEventListener('fetch', (event) => {
  // Respondemos con el recurso o vamos a la red
  event.respondWith(
    fetch(event.request).catch((err) => {
      console.error('Service Worker: Fallo en fetch a la red, recurriendo a cache:', err);
      return caches.match(event.request);
    })
  );
});
