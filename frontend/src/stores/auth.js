import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, startNewSlot } from '@/api/http';
import { useRealtimeStore } from './realtime';
import { useChatStore } from './chat';
import { setLocale, currentLocale } from '@/i18n';
import { forgetDevice } from '@/utils/push';

/**
 * The signed-in member for this tab. The session token is an httpOnly cookie the page never sees; the server
 * tells us who we are via /auth/me.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const ready = ref(false);

  const isAuthed = computed(() => Boolean(user.value));

  function setUser(next) {
    user.value = next;
    syncLanguage();
    useRealtimeStore().connect();
  }

  /**
   * The language picked in the app follows the member to other devices. A choice made before signing in
   * (e.g. on the sign-in page) wins over the default English saved on the account.
   */
  function syncLanguage() {
    const saved = user.value?.language;
    if (!saved) return;
    if (saved !== 'en') setLocale(saved);
    else if (currentLocale() !== 'en') api.patch('/users/me/settings', { language: currentLocale() }).catch(() => {});
  }

  async function setLanguage(code) {
    setLocale(code);
    if (!user.value || user.value.language === code) return;
    const { data } = await api.patch('/users/me/settings', { language: code });
    user.value = data.user;
  }

  /** Drops the live socket and cached chats of the account currently signed in to this tab. */
  function endRealtime() {
    useRealtimeStore().disconnect();
    useChatStore().reset();
  }

  async function fetchMe() {
    const { data } = await api.get('/auth/me');
    user.value = data.user;
    return data.user;
  }

  async function init() {
    try {
      await fetchMe();
      syncLanguage();
      useRealtimeStore().connect();
    } catch {
      user.value = null;
    }
    ready.value = true;
  }

  async function login(credentials) {
    // A new slot means signing in here never replaces the account other tabs are using.
    const previousUser = user.value;
    const restoreSlot = startNewSlot();
    let data;
    try {
      ({ data } = await api.post('/auth/login', credentials));
    } catch (err) {
      restoreSlot();
      throw err;
    }
    if (previousUser) endRealtime();
    setUser(data.user);
  }

  /** Creates a pending account; the member can sign in once an admin approves it. */
  async function signup(payload) {
    const { data } = await api.post('/auth/signup', payload);
    return data;
  }

  /** Clears this tab locally right away; the server-side sign-out follows. */
  function logout() {
    endRealtime();
    user.value = null;
    forgetDevice().finally(() => api.post('/auth/logout').catch(() => {}));
  }

  async function resendVerification() {
    const { data } = await api.post('/users/me/verify-email');
    return data;
  }

  /** Forget the session locally after the server already ended it (expired, suspended, signed out elsewhere). */
  function dropSession() {
    endRealtime();
    user.value = null;
  }

  async function updateProfile(patch) {
    const { data } = await api.patch('/users/me', patch);
    user.value = data.user;
  }

  async function updateSettings(patch) {
    const { data } = await api.patch('/users/me/settings', patch);
    user.value = data.user;
  }

  async function saveLocation(coords) {
    const { data } = await api.put('/users/me/location', coords);
    user.value = data.user;
  }

  async function clearLocation() {
    const { data } = await api.delete('/users/me/location');
    user.value = data.user;
  }

  async function uploadAvatar(file, onProgress) {
    const form = new FormData();
    form.append('avatar', file);
    const { data } = await api.post('/users/me/avatar', form, {
      timeout: 60000,
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    });
    user.value = data.user;
  }

  async function removeAvatar() {
    const { data } = await api.delete('/users/me/avatar');
    user.value = data.user;
  }

  /** Keeps this session; the server signs out every other device. Resolves to how many were signed out. */
  async function changePassword(payload) {
    const { data } = await api.patch('/users/me/password', payload);
    user.value = data.user;
    return data.signedOut ?? 0;
  }

  async function deleteAccount(password) {
    await api.delete('/users/me', { data: { password } });
    dropSession();
  }

  function adjustCount(key, delta) {
    if (user.value) user.value[key] = Math.max(0, (user.value[key] || 0) + delta);
  }

  return {
    user,
    ready,
    isAuthed,
    init,
    fetchMe,
    login,
    signup,
    logout,
    dropSession,
    updateProfile,
    updateSettings,
    saveLocation,
    clearLocation,
    uploadAvatar,
    removeAvatar,
    changePassword,
    deleteAccount,
    adjustCount,
    setLanguage,
    resendVerification,
  };
});
