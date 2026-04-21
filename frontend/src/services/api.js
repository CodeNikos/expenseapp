/**
 * Base del API (sin /api). En prod con mismo host: deja VITE_API_URL vacia → rutas relativas /api/...
 * Si en prod el build incluye localhost por error, se ignora y se usa mismo origen.
 */
const API_URL = (() => {
  const raw = import.meta.env.VITE_API_URL;
  if (raw != null && String(raw).trim() !== '') {
    let base = String(raw).replace(/\/$/, '');
    if (import.meta.env.PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base)) {
      base = '';
    }
    return base;
  }
  return import.meta.env.DEV ? 'http://localhost:8000' : '';
})();

/** Convierte detail de FastAPI/Pydantic (string, objeto o lista) en texto legible. */
function formatApiDetail(detail) {
  if (detail == null) {
    return '';
  }
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc = Array.isArray(item.loc) ? item.loc.join('.') : '';
          return loc ? `${loc}: ${item.msg}` : String(item.msg);
        }
        return JSON.stringify(item);
      })
      .join(' ');
  }
  if (typeof detail === 'object' && detail !== null) {
    return JSON.stringify(detail);
  }
  return String(detail);
}

async function request(path, options = {}) {
  const { token, headers, body, ...rest } = options;
  const finalHeaders = new Headers(headers || {});

  if (token) {
    finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  const isFormData = body instanceof FormData;

  if (body && !isFormData && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body && !isFormData ? JSON.stringify(body) : body,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const rawDetail = typeof payload === 'object' && payload !== null ? payload.detail : payload;
    const message = formatApiDetail(rawDetail) || 'Error inesperado al comunicarse con la API';
    throw new Error(message);
  }

  return payload;
}

export function loginRequest(credentials) {
  return request('/api/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export function registerRequest(payload) {
  return request('/api/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export function requestPasswordReset(payload) {
  return request('/api/auth/request-password-reset', {
    method: 'POST',
    body: payload,
  });
}

export function resetPassword(payload) {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: payload,
  });
}

export function getProfile(token) {
  return request('/api/auth/me', {
    method: 'GET',
    token,
  });
}

export function updateUserLanguage(token, payload) {
  return request('/api/auth/language', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function getIntegrationSettings(token) {
  return request('/api/settings/integrations', {
    method: 'GET',
    token,
  });
}

export function updateIntegrationSettings(token, payload) {
  return request('/api/settings/integrations', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function testOdooConnection(token, payload) {
  return request('/api/settings/test-odoo', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function listAdminUsers(token) {
  return request('/api/admin/users', {
    method: 'GET',
    token,
  });
}

export function createAdminUser(token, payload) {
  return request('/api/admin/users', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function getAdminUserIntegrations(token, userId) {
  return request(`/api/admin/users/${userId}/integrations`, {
    method: 'GET',
    token,
  });
}

export function updateAdminUserIntegrations(token, userId, payload) {
  return request(`/api/admin/users/${userId}/integrations`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function testAdminUserOdoo(token, userId, payload) {
  return request(`/api/admin/users/${userId}/test-odoo`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export function processExpense(token, file, payload) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('payload', JSON.stringify(payload || {}));

  return request('/api/expenses/process', {
    method: 'POST',
    token,
    body: formData,
  });
}

export function listExpenses(token) {
  return request('/api/expenses?limit=100', {
    method: 'GET',
    token,
  });
}

export function deleteExpense(token, expenseId) {
  return request(`/api/expenses/${expenseId}`, {
    method: 'DELETE',
    token,
  });
}

export function retryExpenseOdooSync(token, expenseId, file) {
  const body = new FormData();
  if (file) {
    body.append('file', file);
  }

  return request(`/api/expenses/${expenseId}/sync-odoo`, {
    method: 'POST',
    token,
    body,
  });
}
