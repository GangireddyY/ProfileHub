import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, TOKEN_KEY } from '@/api/http';
import { useRealtimeStore } from './realtime';
import { useChatStore } from './chat';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY));
  const user = ref(null);
  const ready = ref(false);

  const isAuthed = computed(() => Boolean(token.value && user.value));

  function setSession(data) {
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem(TOKEN_KEY, data.token);
    useRealtimeStore().connect();
  }

  function clearSession() {
    token.value = null;
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
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
    setSession(data);
  }

  async function signup(payload) {
    const { data } = await api.post('/auth/signup', payload);
    setSession(data);
  }

  function logout() {
    useRealtimeStore().disconnect();
    useChatStore().reset();
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
  };
});
