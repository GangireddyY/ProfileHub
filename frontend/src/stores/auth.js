import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, getToken, saveToken, clearToken } from '@/api/http';
import { useRealtimeStore } from './realtime';
import { useChatStore } from './chat';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken());
  const user = ref(null);
  const ready = ref(false);

  const isAuthed = computed(() => Boolean(token.value && user.value));

  function setSession(data) {
    token.value = data.token;
    user.value = data.user;
    saveToken(data.token);
    useRealtimeStore().connect();
  }

  function clearSession() {
    token.value = null;
    user.value = null;
    clearToken();
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
    if (token.value) {
      try {
        await fetchMe();
        useRealtimeStore().connect();
      } catch (err) {
        if (err.response?.status === 401) clearSession();
      }
    }
    ready.value = true;
  }

  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials);
    // Switching accounts within this tab: the old account's socket must not stay connected.
    if (token.value) endRealtime();
    setSession(data);
  }

  async function signup(payload) {
    const { data } = await api.post('/auth/signup', payload);
    if (token.value) endRealtime();
    setSession(data);
    return data;
  }

  function logout() {
    endRealtime();
    clearSession();
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

  /** The server rotates our token and signs out every other session. */
  async function changePassword(payload) {
    const { data } = await api.patch('/users/me/password', payload);
    const realtime = useRealtimeStore();
    realtime.disconnect();
    setSession(data);
  }

  async function deleteAccount(password) {
    await api.delete('/users/me', { data: { password } });
    logout();
  }

  function adjustCount(key, delta) {
    if (user.value) user.value[key] = Math.max(0, (user.value[key] || 0) + delta);
  }

  return {
    token,
    user,
    ready,
    isAuthed,
    init,
    fetchMe,
    login,
    signup,
    logout,
    updateProfile,
    updateSettings,
    saveLocation,
    clearLocation,
    uploadAvatar,
    removeAvatar,
    changePassword,
    deleteAccount,
    adjustCount,
  };
});
