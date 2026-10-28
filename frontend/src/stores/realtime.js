import { defineStore } from 'pinia';
import { ref, reactive, shallowRef } from 'vue';
import { io } from 'socket.io-client';
import { toast } from '@/composables/useToast';
import { getSlot } from '@/api/http';
import { useAuthStore } from './auth';
import { useChatStore } from './chat';
import { useProfessionsStore } from './professions';
import { t } from '@/i18n';

export const useRealtimeStore = defineStore('realtime', () => {
  const socket = shallowRef(null);
  const connected = ref(false);
  /** userId -> { online, lastSeenAt } pushed live by the server. */
  const presence = reactive({});
  /** Bumped whenever the server says our network changed, so views can refetch. */
  const networkVersion = ref(0);

  function connect() {
    const auth = useAuthStore();
    if (!auth.user || socket.value) return;
    const chat = useChatStore();

    const s = io(import.meta.env.VITE_SOCKET_URL || undefined, {
      // The session cookie authenticates; the slot says which of this browser's sessions this tab uses.
      withCredentials: true,
      auth: (cb) => cb({ slot: getSlot() }),
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
      // Ask the API why: its 401 carries the reason (expired, password changed, suspended) and signs us out.
      if (err.message === 'Unauthorized') useAuthStore().fetchMe().catch(() => {});
    });

    s.on('presence', (p) => {
      presence[p.userId] = { online: p.online, lastSeenAt: p.lastSeenAt };
    });

    s.on('message:new', (m) => chat.receive(m));
    s.on('message:updated', (m) => chat.applyUpdate(m));
    s.on('conversation:cleared', (e) => chat.onCleared(e));
    s.on('message:read', (e) => chat.onRead(e));
    s.on('message:read-self', (e) => chat.onReadSelf(e));
    s.on('typing', (e) => chat.setTyping(e.from, e.typing));

    s.on('connection:request', ({ user }) => {
      toast.info(t('toast.invitation', { name: user.name }), {
        title: t('toast.invitationTitle'),
        avatar: user,
        action: { label: t('common.review'), to: '/network' },
      });
    });
    s.on('connection:accepted', ({ user }) => {
      toast.success(t('toast.accepted', { name: user.name }), {
        title: t('toast.acceptedTitle'),
        avatar: user,
        action: { label: t('common.message'), to: `/messages/${user.id}` },
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
      } else if (notification?.type === 'plan_approved') {
        auth.fetchMe().catch(() => {});
        toast.success('An admin approved your plan request. Your new plan is active.', {
          title: 'Plan upgraded',
          action: { label: 'View plans', to: '/plans' },
        });
      } else if (notification?.type === 'plan_rejected') {
        toast.info('An admin reviewed your plan request.', { title: 'Plan request reviewed', action: { label: 'View', to: '/plans' } });
      } else if (notification?.type === 'plan_request' && actor) {
        toast.info(`${actor.name} asked for a plan upgrade`, {
          title: 'New plan request',
          avatar: actor,
          action: { label: 'Review', to: '/admin?tab=plan-requests' },
        });
      } else if (notification?.type === 'profession_request' && actor) {
        toast.info(`${actor.name} asked for a new profession`, {
          title: 'New profession request',
          avatar: actor,
          action: { label: 'Review', to: '/admin?tab=requests' },
        });
      } else if (notification?.type === 'signup_request' && actor) {
        toast.info(`${actor.name} signed up and is waiting for approval`, {
          title: 'New member to approve',
          avatar: actor,
          action: { label: 'Review', to: '/admin?tab=approvals' },
        });
      } else if (notification?.type === 'report_new' && actor) {
        toast.info(`${actor.name} reported something for review`, {
          title: 'New report',
          avatar: actor,
          action: { label: 'Review', to: '/admin?tab=reports' },
        });
      } else if (notification?.type === 'listing_removed') {
        toast.error(`An admin ${notification.data?.action === 'deleted' ? 'removed' : 'hid'} your listing “${notification.data?.title ?? ''}”.`, {
          title: 'Listing moderated',
          action: { label: 'View', to: '/notifications' },
        });
      } else if (notification?.type === 'review_new' && actor) {
        auth.fetchMe().catch(() => {});
        toast.success(t('toast.reviewNew', { name: actor.name, rating: notification.data?.rating ?? '' }), {
          title: t('toast.reviewNewTitle'),
          avatar: actor,
          action: { label: t('common.view'), to: `/u/${auth.user?.id}` },
        });
      } else if (notification?.type === 'plan_expiring') {
        toast.info(`Your ${notification.data?.planName ?? ''} plan ends soon.`, { title: 'Plan ending', action: { label: 'Plans', to: '/plans' } });
      } else if (notification?.type === 'plan_expired') {
        auth.fetchMe().catch(() => {});
        toast.info(`Your ${notification.data?.planName ?? ''} plan ended, so you're back on ${notification.data?.fallbackName ?? 'the free plan'}.`, {
          title: 'Plan ended',
          action: { label: 'Plans', to: '/plans' },
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
