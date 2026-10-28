import axios from 'axios';
import { toast } from '@/composables/useToast';

/*
 * The session itself lives in an httpOnly cookie that page scripts can't read. Each tab only keeps a
 * "slot" name (not a secret) telling the server which of the browser's session cookies to use, so different
 * tabs can be signed in as different accounts. A new tab adopts the slot of the latest sign-in once.
 */
const SLOT_KEY = 'ph_slot';
const LAST_SLOT_KEY = 'ph_last_slot';
const randomSlot = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);

// Tokens from before sessions moved to cookies are useless now; don't leave them lying around.
sessionStorage.removeItem('ph_token');
localStorage.removeItem('ph_token');

if (!sessionStorage.getItem(SLOT_KEY)) {
  sessionStorage.setItem(SLOT_KEY, localStorage.getItem(LAST_SLOT_KEY) || randomSlot());
}

export const getSlot = () => sessionStorage.getItem(SLOT_KEY);

/**
 * A fresh slot for a new sign-in in this tab; other tabs keep theirs, and new tabs will open with this one.
 * Returns a function that puts the previous slot back (e.g. when the password was wrong).
 */
export function startNewSlot() {
  const previous = { slot: getSlot(), last: localStorage.getItem(LAST_SLOT_KEY) };
  const slot = randomSlot();
  sessionStorage.setItem(SLOT_KEY, slot);
  localStorage.setItem(LAST_SLOT_KEY, slot);
  return () => {
    sessionStorage.setItem(SLOT_KEY, previous.slot);
    if (previous.last) localStorage.setItem(LAST_SLOT_KEY, previous.last);
    else localStorage.removeItem(LAST_SLOT_KEY);
  };
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  config.headers['X-PH-Slot'] = getSlot();
  // Required by the server's CSRF guard on anything that changes data.
  config.headers['X-PH-Client'] = 'web';
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isAuthCall = ['/auth/login', '/auth/signup', '/auth/logout'].some((p) => error.config?.url?.startsWith(p));
    if (error.response?.status === 401 && !isAuthCall) {
      window.dispatchEvent(new CustomEvent('auth:expired', { detail: { message: error.response.data?.message } }));
    }
    // Anything blocked by the member's plan gets one toast with a way to upgrade; the page's own
    // toast with the same message is then skipped as a duplicate.
    if (error.response?.status === 403 && error.response.data?.details?.code === 'plan_limit') {
      toast.error(error.response.data.message, { action: { label: 'View plans', to: '/plans' } });
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
