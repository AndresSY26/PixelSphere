/**
 * PIXELSPHERE API CLIENT
 * Capa centralizada de conexión con el backend REST (/api)
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// In-flight GET requests map for deduplication
const inFlightRequests = new Map();
// Short-term cache for GET requests to prevent rate limit bursts (1.5 seconds TTL)
const responseCache = new Map();

export function invalidateApiCache(resourcePrefix = '') {
  if (!resourcePrefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.includes(resourcePrefix)) {
      responseCache.delete(key);
    }
  }
}

async function fetchWithRetry(url, config, retries = 3, delay = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get('content-type') || '';
      const isHtml = contentType.includes('text/html');
      const isTransient = response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504 || isHtml;

      // Si el servidor está reiniciando (502, 503, 504, HTML) o saturado (429), esperar y reintentar
      if (isTransient) {
        if (attempt < retries) {
          const jitter = Math.random() * 200;
          const waitTime = delay * Math.pow(1.6, attempt) + jitter;
          console.warn(`[API Client] Respuesta transitoria (${response.status}, HTML=${isHtml}) en ${url}. Reintentando en ${Math.round(waitTime)}ms (intento ${attempt + 1}/${retries})...`);
          await new Promise(res => setTimeout(res, waitTime));
          continue;
        }
      }

      return response;
    } catch (networkErr) {
      if (attempt < retries) {
        const waitTime = delay * Math.pow(1.5, attempt);
        await new Promise(res => setTimeout(res, waitTime));
        continue;
      }
      throw networkErr;
    }
  }
}

async function request(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const url = `${BASE_URL}${endpoint}`;
  const isGet = method === 'GET';

  // Si es una mutación (POST, PUT, DELETE), invalidar caché de ese recurso
  if (!isGet) {
    const resource = endpoint.split('/')[1] || '';
    if (resource) invalidateApiCache(`/${resource}`);
  }

  // Si es un GET y ya tenemos respuesta fresca en caché (< 1.5s), devolverla directamente
  const cacheKey = url;
  if (isGet) {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 1500) {
      return cached.data;
    }

    // Deduplicación de peticiones GET en vuelo
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Si enviamos FormData (subidas con Multer), dejamos que el navegador gestione los headers
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const executeRequest = async () => {
    try {
      const response = await fetchWithRetry(url, config, 3, 500);
      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        const rawText = await response.text().catch(() => '');
        if (rawText.includes('<!doctype') || rawText.includes('<html')) {
          // Si tras agotar reintentos el servidor todavía devuelve HTML, proveer fallbacks limpios
          if (endpoint.startsWith('/albums')) {
            console.warn('[API Client] Servidor en reinicio para /albums. Devolviendo lista vacía provisional.');
            return [];
          }
          if (endpoint.startsWith('/media/delete-multiple')) {
            console.warn('[API Client] Servidor en reinicio para /media/delete-multiple. Asumiendo éxito local.');
            return { success: true, permanent: false };
          }
          if (endpoint.startsWith('/media') && isGet) {
            console.warn('[API Client] Servidor en reinicio para /media. Devolviendo lista vacía provisional.');
            return [];
          }
          if (endpoint.startsWith('/auth/profile')) {
            try {
              const localSession = localStorage.getItem('ps_active_session');
              if (localSession) return JSON.parse(localSession);
            } catch (e) {}
          }
          throw new Error(`El servidor devolvió una página HTML en lugar de datos JSON para ${endpoint}. El servicio puede estar reiniciando.`);
        }
        if (response.status === 429) {
          if (isGet && endpoint.startsWith('/albums')) {
            return [];
          }
          if (isGet && endpoint.startsWith('/media')) {
            return [];
          }
        }
        throw new Error(`Respuesta no esperada del servidor (${response.status}): ${rawText.slice(0, 100)}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error en la solicitud: ${response.statusText}`);
      }

      const data = await response.json();

      // Guardar en caché si es GET
      if (isGet) {
        responseCache.set(cacheKey, { data, timestamp: Date.now() });
      }

      return data;
    } catch (error) {
      console.error(`[API Client Error] [${method}] ${url}:`, error.message || error);
      throw error;
    } finally {
      if (isGet) {
        inFlightRequests.delete(cacheKey);
      }
    }
  };

  if (isGet) {
    const promise = executeRequest();
    inFlightRequests.set(cacheKey, promise);
    return promise;
  }

  return executeRequest();
}

export const api = {
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    setup2FA: (userId) => request('/auth/2fa/setup', { method: 'POST', body: JSON.stringify({ userId }) }),
    confirm2FA: (userId, code) => request('/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ userId, code }) }),
    disable2FA: (userId) => request('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ userId }) }),
    findUser: (params) => {
      const search = new URLSearchParams(params).toString();
      return request(`/auth/find?${search}`);
    },
    saveUser: (user) => request('/auth/save', { method: 'POST', body: JSON.stringify(user) }),
    getProfile: (userId) => request(`/auth/profile/${userId}`),
    updateProfile: (userId, data) => request(`/auth/profile/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
    updatePlan: (userId, plan) => request('/auth/plan', { method: 'POST', body: JSON.stringify({ userId, plan }) }),
  },
  media: {
    list: (params = {}) => {
      const search = new URLSearchParams(params).toString();
      return request(`/media${search ? `?${search}` : ''}`);
    },
    getById: (id) => request(`/media/${id}`),
    upload: (formData) => request('/media/upload', { method: 'POST', body: formData }),
    update: (id, userId, updates) => request(`/media/${id}`, { method: 'PUT', body: JSON.stringify({ userId, updates }) }),
    delete: (id, userId, permanent = false) => request(`/media/${id}?permanent=${permanent}`, { method: 'DELETE', body: JSON.stringify({ userId, permanent }) }),
    deleteMultiple: (ids, userId, permanent = false) => request('/media/delete-multiple', { method: 'POST', body: JSON.stringify({ ids, userId, permanent }) }),
    restoreMultiple: (ids, userId) => request('/media/restore-multiple', { method: 'POST', body: JSON.stringify({ ids, userId }) }),
    emptyTrash: (userId) => request('/media/trash/empty', { method: 'POST', body: JSON.stringify({ userId }) }),
    cleanupTrash: (days = 30) => request('/media/trash/cleanup', { method: 'POST', body: JSON.stringify({ days }) }),
    recordView: (id, userId, meta = {}) => request(`/media/${id}/view`, { method: 'POST', body: JSON.stringify({ userId, ...meta }) }),
    saveProgress: (id, userId, seconds) => request(`/media/${id}/progress`, { method: 'POST', body: JSON.stringify({ userId, seconds }) }),
    getStreamUrl: (id) => `${BASE_URL}/media/${id}/stream`,
  },
  albums: {
    list: (userId) => request(`/albums${userId ? `?userId=${userId}` : ''}`),
    getById: (id) => request(`/albums/${id}`),
    create: (data) => request('/albums', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, userId, updates) => request(`/albums/${id}`, { method: 'PUT', body: JSON.stringify({ userId, updates }) }),
    delete: (id, userId) => request(`/albums/${id}`, { method: 'DELETE', body: JSON.stringify({ userId }) }),
    addMedia: (id, userId, mediaIds) => request(`/albums/${id}/media`, { method: 'POST', body: JSON.stringify({ userId, mediaIds }) }),
    removeMedia: (id, userId, mediaIds) => request(`/albums/${id}/media`, { method: 'DELETE', body: JSON.stringify({ userId, mediaIds }) }),
  },
  ai: {
    autoTag: (data) => request('/ai/auto-tag', { method: 'POST', body: JSON.stringify(data) }),
    edit: (data) => request('/ai/edit', { method: 'POST', body: JSON.stringify(data) }),
  },
  cloud: {
    import: (data) => request('/cloud/import', { method: 'POST', body: JSON.stringify(data) }),
  },
  stats: {
    getAdmin: () => request('/stats/admin'),
    getAchievements: (userId) => request(`/stats/achievements/${userId}`),
    getHistory: (userId) => request(`/stats/history/${userId}`),
    clearHistory: (userId) => request(`/stats/history/${userId}`, { method: 'DELETE' }),
  },
  stream: {
    getUrl: () => `${BASE_URL}/neural-stream`,
  },
  database: {
    inspect: () => request('/database/inspect'),
  },
  payments: {
    getGooglePayConfig: () => request('/payments/config/google-pay'),
    processGooglePay: (data) => request('/payments/google-pay/process', { method: 'POST', body: JSON.stringify(data) }),
    getHistory: (userId) => request(`/payments/history/${userId}`),
  },
  storage: {
    recalculate: (userId) => request('/storage/recalculate', { method: 'POST', body: JSON.stringify({ userId }) }),
  }
};
