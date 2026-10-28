import axios from 'axios';

export const TOKEN_KEY = 'ph_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
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
