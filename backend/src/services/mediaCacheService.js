import crypto from 'node:crypto';

/**
 * ULTRA-FAST IN-MEMORY LRU MEDIA CACHE
 * Evita descargas redundantes desde Firebase Storage WAN.
 * Satisface peticiones Range (HTTP 206) y vistas repetidas en < 1ms directamente desde memoria RAM.
 */

// Capacidad máxima de memoria RAM asignada al caché multimedia: 128MB
const MAX_CACHE_BYTES = 128 * 1024 * 1024;
let currentCacheBytes = 0;

const cache = new Map();
const inFlightRequests = new Map();

function evictIfNecessary(neededBytes) {
  if (currentCacheBytes + neededBytes <= MAX_CACHE_BYTES) return;

  // Ordenar por acceso más antiguo (LRU)
  const entries = Array.from(cache.entries()).sort(
    (a, b) => a[1].lastAccessed - b[1].lastAccessed
  );

  for (const [key, item] of entries) {
    cache.delete(key);
    currentCacheBytes -= item.size;
    if (currentCacheBytes + neededBytes <= MAX_CACHE_BYTES) break;
  }
}

export function getCachedMedia(key) {
  const item = cache.get(key);
  if (!item) return null;
  item.lastAccessed = Date.now();
  return item;
}

export function setCachedMedia(key, buffer, contentType) {
  if (!buffer || buffer.length === 0) return null;

  // Si el archivo individual supera 40MB, no saturar el caché en RAM completo
  if (buffer.length > 40 * 1024 * 1024) {
    const etag = `"${crypto.createHash('md5').update(buffer.subarray(0, Math.min(1024 * 1024, buffer.length))).digest('hex')}"`;
    return { buffer, contentType, etag, size: buffer.length, lastAccessed: Date.now() };
  }

  const existing = cache.get(key);
  if (existing) {
    currentCacheBytes -= existing.size;
    cache.delete(key);
  }

  evictIfNecessary(buffer.length);

  const etag = `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
  const cachedItem = {
    buffer,
    contentType,
    etag,
    size: buffer.length,
    lastAccessed: Date.now()
  };

  cache.set(key, cachedItem);
  currentCacheBytes += buffer.length;
  return cachedItem;
}

export function primeMediaCache(key, buffer, contentType) {
  try {
    setCachedMedia(key, buffer, contentType);
  } catch (e) {}
}

export function deleteCachedMedia(keyPrefix) {
  for (const [k, item] of cache.entries()) {
    if (k.includes(keyPrefix)) {
      currentCacheBytes -= item.size;
      cache.delete(k);
    }
  }
}

export function getInFlight(key) {
  return inFlightRequests.get(key);
}

export function setInFlight(key, promise) {
  inFlightRequests.set(key, promise);
  promise.finally(() => {
    inFlightRequests.delete(key);
  });
}
