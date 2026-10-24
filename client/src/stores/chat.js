import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import { api, errorMessage } from '@/api/http';
import { useAuthStore } from './auth';
import { useRealtimeStore } from './realtime';

const emptyThread = () => ({
  user: null,
  messages: [],
  hasMore: false,
  loading: false,
  loadingOlder: false,
  loaded: false,
  canMessage: false,
  error: '',
});

export const useChatStore = defineStore('chat', () => {
  const conversations = ref([]);
  const conversationsLoaded = ref(false);
  const threads = reactive({});
  const typing = reactive({});
  const typingTimers = {};
  const activeUserId = ref(null);

  const totalUnread = computed(() => conversations.value.reduce((sum, c) => sum + (c.unread || 0), 0));

  const myId = () => useAuthStore().user?.id;

  function thread(userId) {
    if (!threads[userId]) threads[userId] = emptyThread();
    return threads[userId];
  }

  async function loadConversations() {
    const { data } = await api.get('/messages/conversations');
    conversations.value = data.items;
    conversationsLoaded.value = true;
  }

  async function openThread(userId) {
    const t = thread(userId);
    activeUserId.value = userId;
    t.loading = !t.loaded;
    t.error = '';
    try {
      const { data } = await api.get(`/messages/${userId}`);
      const pending = t.messages.filter((m) => m.pending || m.failed);
      Object.assign(t, {
        user: data.user,
        messages: [...data.messages, ...pending],
        hasMore: data.hasMore,
        canMessage: data.canMessage,
        loaded: true,
      });
      markRead(userId);
    } catch (err) {
      t.error = errorMessage(err);
    } finally {
      t.loading = false;
    }
  }

  function closeThread(userId) {
    if (activeUserId.value === userId) activeUserId.value = null;
  }

  async function loadOlder(userId) {
    const t = thread(userId);
    if (!t.hasMore || t.loadingOlder) return;
    const oldest = t.messages.find((m) => !m.pending && !m.failed);
    if (!oldest) return;
    t.loadingOlder = true;
    try {
      const { data } = await api.get(`/messages/${userId}`, { params: { before: oldest.createdAt } });
      t.messages = [...data.messages, ...t.messages];
      t.hasMore = data.hasMore;
    } finally {
      t.loadingOlder = false;
    }
  }

  function upsertConversation(partnerId, message, { incrementUnread = false } = {}) {
    const idx = conversations.value.findIndex((c) => c.user.id === partnerId);
    if (idx === -1) {
      const user = threads[partnerId]?.user;
      if (user) {
        conversations.value.unshift({ user, lastMessage: message, unread: incrementUnread ? 1 : 0, canMessage: true });
      } else {
        loadConversations().catch(() => {});
      }
      return;
    }
    const [c] = conversations.value.splice(idx, 1);
    c.lastMessage = message;
    if (incrementUnread) c.unread = (c.unread || 0) + 1;
    conversations.value.unshift(c);
  }

  /** Swap an optimistic message for the saved one, tolerating either arrival order (ack vs socket echo). */
  function settle(t, tempId, saved) {
    const tempIdx = t.messages.findIndex((m) => m.id === tempId);
    const exists = t.messages.some((m) => m.id === saved.id);
    if (tempIdx === -1) {
      if (!exists) t.messages.push(saved);
    } else if (exists) {
      t.messages.splice(tempIdx, 1);
    } else {
      t.messages.splice(tempIdx, 1, saved);
    }
  }

  async function send(userId, body) {
    const realtime = useRealtimeStore();
    const t = thread(userId);
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    t.messages.push({
      id: tempId,
      senderId: myId(),
      receiverId: userId,
      body,
      createdAt: new Date().toISOString(),
      readAt: null,
      pending: true,
    });

    try {
      const res = realtime.connected
        ? await realtime.emitAck('message:send', { to: userId, body })
        : (await api.post(`/messages/${userId}`, { body })).data;
      settle(t, tempId, res.message);
      upsertConversation(userId, res.message);
    } catch (err) {
      const m = t.messages.find((x) => x.id === tempId);
      if (m) Object.assign(m, { pending: false, failed: true, error: errorMessage(err) });
    }
  }

  async function retry(userId, messageId) {
    const t = thread(userId);
    const idx = t.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const [m] = t.messages.splice(idx, 1);
    await send(userId, m.body);
  }

  function discard(userId, messageId) {
    const t = thread(userId);
    t.messages = t.messages.filter((m) => m.id !== messageId);
  }

  function receive(m) {
    const me = myId();
    const incoming = m.senderId !== me;
    const partnerId = incoming ? m.senderId : m.receiverId;
    const t = threads[partnerId];

    if (t?.loaded && !t.messages.some((x) => x.id === m.id)) {
      const tempIdx = incoming ? -1 : t.messages.findIndex((x) => x.pending && x.body === m.body);
      if (tempIdx !== -1) t.messages.splice(tempIdx, 1, m);
      else t.messages.push(m);
    }

    const viewing = incoming && activeUserId.value === partnerId && document.visibilityState === 'visible';
    upsertConversation(partnerId, m, { incrementUnread: incoming && !viewing });

    if (incoming) {
      setTyping(partnerId, false);
      if (viewing) markRead(partnerId);
    }
  }

  function markRead(userId) {
    const me = myId();
    const t = threads[userId];
    const convo = conversations.value.find((c) => c.user.id === userId);
    const hasUnread = (convo?.unread || 0) > 0 || t?.messages.some((m) => m.senderId === userId && !m.readAt);
    if (convo) convo.unread = 0;
    if (!hasUnread) return;

    const now = new Date().toISOString();
    t?.messages.forEach((m) => {
      if (m.senderId === userId && m.receiverId === me && !m.readAt) m.readAt = now;
    });
    api.post(`/messages/${userId}/read`).catch(() => {});
  }

  /** The other person read my messages. */
  function onRead({ by, at }) {
    const me = myId();
    threads[by]?.messages.forEach((m) => {
      if (m.senderId === me && !m.readAt) m.readAt = at;
    });
    const convo = conversations.value.find((c) => c.user.id === by);
    if (convo?.lastMessage?.senderId === me && !convo.lastMessage.readAt) convo.lastMessage.readAt = at;
  }

  /** I read a conversation on another tab/device. */
  function onReadSelf({ from }) {
    const convo = conversations.value.find((c) => c.user.id === from);
    if (convo) convo.unread = 0;
  }

  function setTyping(userId, isTyping) {
    clearTimeout(typingTimers[userId]);
    typing[userId] = isTyping;
    if (isTyping) typingTimers[userId] = setTimeout(() => (typing[userId] = false), 5000);
  }

  function reset() {
    conversations.value = [];
    conversationsLoaded.value = false;
    activeUserId.value = null;
    for (const key of Object.keys(threads)) delete threads[key];
    for (const key of Object.keys(typing)) delete typing[key];
  }

  return {
    conversations,
    conversationsLoaded,
    threads,
    typing,
    activeUserId,
    totalUnread,
    thread,
    loadConversations,
    openThread,
    closeThread,
    loadOlder,
    send,
    retry,
    discard,
    receive,
    markRead,
    onRead,
    onReadSelf,
    setTyping,
    reset,
  };
});
