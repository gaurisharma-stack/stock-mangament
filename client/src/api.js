const API = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

function getToken() {
  return localStorage.getItem('stockflow_token');
}

function setToken(token) {
  localStorage.setItem('stockflow_token', token);
}

function removeToken() {
  localStorage.removeItem('stockflow_token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${url}`, {
    headers,
    ...options,
  });

  // If unauthorized, clear token and redirect to login
  if (res.status === 401) {
    removeToken();
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const auth = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  join: (data) => request('/auth/join', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  setToken,
  getToken,
  logout: () => {
    removeToken();
    window.location.reload();
  },
};

export const api = {
  // Items
  getItems: (params = '') => request(`/items${params ? '?' + params : ''}`),
  getItem: (code) => request(`/items/${encodeURIComponent(code)}`),
  getStats: () => request('/items/stats'),
  getCategories: () => request('/items/categories'),
  createItem: (data) => request('/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (code, data) => request(`/items/${encodeURIComponent(code)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (code) => request(`/items/${encodeURIComponent(code)}`, { method: 'DELETE' }),

  // Transactions
  getTransactions: (params = '') => request(`/transactions${params ? '?' + params : ''}`),
  purchase: (data) => request('/transactions/purchase', { method: 'POST', body: JSON.stringify(data) }),
  sale: (data) => request('/transactions/sale', { method: 'POST', body: JSON.stringify(data) }),
  broken: (data) => request('/transactions/broken', { method: 'POST', body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),

  // Production
  getRecipes: () => request('/production/recipes'),
  createRecipe: (data) => request('/production/recipes', { method: 'POST', body: JSON.stringify(data) }),
  produce: (data) => request('/production/produce', { method: 'POST', body: JSON.stringify(data) }),
};
