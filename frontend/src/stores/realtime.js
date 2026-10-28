import { defineStore } from 'pinia';
import { ref, reactive, shallowRef } from 'vue';
import { io } from 'socket.io-client';
import { toast } from '@/composables/useToast';
import { useAuthStore } from './auth';
import { useChatStore } from './chat';
import { useProfessionsStore } from './professions';

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
      // Evaluated on every (re)connect so a rotated token is always used.
      auth: (cb) => cb({ token: useAuthStore().token }),
      reconnectionDelayMax: 8000,
    });
    const isCurrent = () => socket.value === s;

    s.on('connect', () => {
      connected.value = true;
      chat.loadConversations().catch(() => {});
      useProfessionsStore().load().catch(() => {});
    });
    s.on('disconnect', (reason) => {
      if (!isCurrent()) return;
      connected.value = false;
      // A server-initiated disconnect (e.g. password changed elsewhere) won't auto-retry; reconnecting
      // re-runs auth, which signs this tab out if its token is no longer valid.
      if (reason === 'io server disconnect') setTimeout(() => isCurrent() && s.connect(), 500);
    });
    s.on('connect_error', (err) => {
      if (!isCurrent()) return;
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
    s.on('notification:new', ({ notification } = {}) => {
      auth.adjustCount('unreadNotifications', 1);
      const actor = notification?.actor;
      if (notification?.type === 'profession_approved') {
        // The admin may have just set our profession; refresh both the catalog and our profile.
        useProfessionsStore().refresh().catch(() => {});
        auth.fetchMe().catch(() => {});
        toast.success('Your profession request was approved and added to the list.', {
          title: 'Request approved',
          action: { label: 'View', to: '/notifications' },
        });
      } else if (notification?.type === 'profession_rejected') {
        toast.info('An admin reviewed your profession request.', { title: 'Request reviewed', action: { label: 'View', to: '/notifications' } });
      } else if (notification?.type === 'profession_request' && actor) {
        toast.info(`${actor.name} asked for a new profession`, {
          title: 'New profession request',
          avatar: actor,
          action: { label: 'Review', to: '/admin' },
        });
      }
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
