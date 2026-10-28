import axios from 'axios';

const TOKEN_KEY = 'ph_token';

/*
 * Each tab keeps its own session in sessionStorage, so signing in as someone else in one tab (e.g. an admin)
 * never switches the account of the others. localStorage only remembers the latest sign-in, which a newly
 * opened tab adopts once when it loads.
 */
if (!sessionStorage.getItem(TOKEN_KEY)) {
  const latest = localStorage.getItem(TOKEN_KEY);
  if (latest) sessionStorage.setItem(TOKEN_KEY, latest);
}

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);

export function saveToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  const token = getToken();
  sessionStorage.removeItem(TOKEN_KEY);
  if (localStorage.getItem(TOKEN_KEY) === token) localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/login') || error.config?.url?.startsWith('/auth/signup');
    if (error.response?.status === 401 && !isAuthCall) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error, fallback = 'Something went wrong') {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ECONNABORTED') return 'The request timed out, please try again';
  if (error?.message === 'Network Error') return 'Cannot reach the server, check your connection';
  return error?.message || fallback;
}

export function fieldErrors(error) {
  return error?.response?.data?.details?.fields || {};
}
