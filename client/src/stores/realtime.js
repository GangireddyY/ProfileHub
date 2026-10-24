import { defineStore } from 'pinia';
import { ref, reactive, shallowRef } from 'vue';
import { io } from 'socket.io-client';
import { toast } from '@/composables/useToast';
import { useAuthStore } from './auth';
import { useChatStore } from './chat';

export const useRealtimeStore = defineStore('realtime', () => {
  const socket = shallowRef(null);
  const connected = ref(false);
  /** userId -> { online, lastSeenAt } pushed live by the server. */
  const presence = reactive({});
  /** Bumped whenever the server says our network changed, so views can refetch. */
  const networkVersion = ref(0);

  function connect() {
    const auth = useAuthStore();
    if (!auth.token || socket.value) return;
    const chat = useChatStore();

    const s = io(import.meta.env.VITE_SOCKET_URL || undefined, {
      auth: { token: auth.token },
      reconnectionDelayMax: 8000,
    });

    s.on('connect', () => {
      connected.value = true;
      chat.loadConversations().catch(() => {});
    });
    s.on('disconnect', () => (connected.value = false));
    s.on('connect_error', (err) => {
      connected.value = false;
      if (err.message === 'Unauthorized') window.dispatchEvent(new CustomEvent('auth:expired'));
    });

    s.on('presence', (p) => {
      presence[p.userId] = { online: p.online, lastSeenAt: p.lastSeenAt };
    });

    s.on('message:new', (m) => chat.receive(m));
    s.on('message:read', (e) => chat.onRead(e));
    s.on('message:read-self', (e) => chat.onReadSelf(e));
    s.on('typing', (e) => chat.setTyping(e.from, e.typing));

    s.on('connection:request', ({ user }) => {
      toast.info(`${user.name} wants to join your network`, {
        title: 'New invitation',
        avatar: user,
        action: { label: 'Review', to: '/network' },
      });
    });
    s.on('connection:accepted', ({ user }) => {
      toast.success(`${user.name} accepted your invitation`, {
        title: 'New connection',
        avatar: user,
        action: { label: 'Message', to: `/messages/${user.id}` },
      });
    });
    s.on('network:changed', () => {
      networkVersion.value++;
      auth.fetchMe().catch(() => {});
    });

    socket.value = s;
  }

  function disconnect() {
    socket.value?.disconnect();
    socket.value = null;
    connected.value = false;
    for (const key of Object.keys(presence)) delete presence[key];
  }

  function isOnline(userId, fallback = false) {
    return presence[userId] ? presence[userId].online : fallback;
  }

  function lastSeen(userId, fallback = null) {
    return presence[userId] ? presence[userId].lastSeenAt : fallback;
  }

  function emit(event, payload) {
    socket.value?.emit(event, payload);
  }

  function emitAck(event, payload, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!socket.value) return reject(new Error('Not connected'));
      socket.value.timeout(timeout).emit(event, payload, (err, res) => {
        if (err) return reject(new Error('The server did not respond in time'));
        if (!res?.ok) return reject(new Error(res?.message || 'Request failed'));
        resolve(res);
      });
    });
  }

  return { socket, connected, presence, networkVersion, connect, disconnect, isOnline, lastSeen, emit, emitAck };
});
