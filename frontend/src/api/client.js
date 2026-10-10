/**
 * PIXELSPHERE API CLIENT
 * Capa centralizada de conexión con el backend REST (/api)
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
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

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error en la solicitud: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[API Client Error] [${options.method || 'GET'}] ${url}:`, error);
    throw error;
  }
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
  }
};
