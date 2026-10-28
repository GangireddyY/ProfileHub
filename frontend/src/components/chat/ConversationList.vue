<script setup>
import { ref, computed } from 'vue';
import { Search, SquarePen, MessagesSquare, Check, CheckCheck } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useRealtimeStore } from '@/stores/realtime';
import { formatStamp } from '@/utils/format';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import BackButton from '@/components/BackButton.vue';

defineProps({
  activeId: { type: String, default: '' },
  /** Where the back arrow leads: the page the user came from before opening Messages. */
  backTo: { type: [String, Object], default: '/' },
});
const emit = defineEmits(['new-chat']);

const auth = useAuthStore();
const chat = useChatStore();
const realtime = useRealtimeStore();
const search = ref('');

const items = computed(() => {
  const q = search.value.trim().toLowerCase();
  return chat.conversations.filter((c) => !q || c.user.name.toLowerCase().includes(q));
});
</script>

<template>
  <div class="clist">
    <header class="clist__head">
      <div class="clist__title">
        <BackButton icon-only :to="backTo" />
        <h1 class="page-title">Messages</h1>
      </div>
      <UiButton variant="soft" size="sm" :icon="SquarePen" icon-only aria-label="New message" @click="emit('new-chat')" />
    </header>

    <label class="clist__search">
      <Search />
      <input v-model="search" type="search" placeholder="Search conversations" aria-label="Search conversations" />
    </label>

    <div class="clist__items">
      <template v-if="!chat.conversationsLoaded">
        <div v-for="i in 5" :key="i" class="citem">
          <UiSkeleton width="48px" height="48px" radius="50%" />
          <div class="stack grow" style="--gap: 8px">
            <UiSkeleton width="50%" height="13px" />
            <UiSkeleton width="80%" height="11px" />
          </div>
        </div>
      </template>

      <UiEmpty
        v-else-if="!chat.conversations.length"
        compact
        :icon="MessagesSquare"
        title="No conversations yet"
        description="Start chatting with someone from your network."
      >
        <UiButton size="sm" @click="emit('new-chat')">New message</UiButton>
      </UiEmpty>

      <p v-else-if="!items.length" class="subtle empty-search">No conversations match "{{ search }}"</p>

      <RouterLink
        v-for="c in items"
        :key="c.user.id"
        :to="`/messages/${c.user.id}`"
        class="citem"
        :class="{ 'is-active': activeId === c.user.id, 'is-unread': c.unread }"
      >
        <UiAvatar :name="c.user.name" :src="c.user.avatarUrl" :size="48" :online="realtime.isOnline(c.user.id, c.user.online)" />
        <div class="citem__body">
          <div class="citem__top">
            <strong class="truncate">{{ c.user.name }}</strong>
            <time class="citem__time">{{ formatStamp(c.lastMessage.createdAt) }}</time>
          </div>
          <div class="citem__bottom">
            <p v-if="chat.typing[c.user.id]" class="citem__typing">typing…</p>
            <p v-else class="citem__preview truncate">
              <template v-if="c.lastMessage.senderId === auth.user.id">
                <CheckCheck v-if="c.lastMessage.readAt" class="tick tick--read" />
                <Check v-else class="tick" />
              </template>
              {{ c.lastMessage.body }}
            </p>
            <span v-if="c.unread" class="citem__unread">{{ c.unread > 9 ? '9+' : c.unread }}</span>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.clist {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.clist__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px 12px;
}
.clist__title {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.clist__title .back-btn {
  align-self: center;
}
.clist__search {
  position: relative;
  display: flex;
  align-items: center;
  margin: 0 16px 10px;
}
.clist__search svg {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
  color: var(--text-3);
}
.clist__search input {
  width: 100%;
  height: 42px;
  padding: 0 12px 0 40px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: var(--surface-3);
  font-size: 16px;
}
.clist__search input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: var(--ring);
}
.clist__items {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 12px;
  overscroll-behavior: contain;
}
.citem {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: var(--radius);
  transition: background-color 0.15s var(--ease);
}
.citem:hover {
  background: var(--surface-2);
}
.citem.is-active {
  background: var(--primary-soft);
}
.citem__body {
  flex: 1;
  min-width: 0;
}
.citem__top,
.citem__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.citem__time {
  font-size: 0.74rem;
  color: var(--text-3);
  flex-shrink: 0;
}
.citem__preview {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.86rem;
  color: var(--text-2);
}
.citem.is-unread .citem__preview {
  color: var(--text);
  font-weight: 600;
}
.citem.is-unread .citem__time {
  color: var(--primary);
  font-weight: 700;
}
.citem__typing {
  font-size: 0.86rem;
  color: var(--success);
  font-weight: 600;
  font-style: italic;
}
.citem__unread {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 99px;
  background: var(--primary);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.tick {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: var(--text-3);
}
.tick--read {
  color: var(--accent);
}
.empty-search {
  text-align: center;
  padding: 20px;
  font-size: 0.88rem;
}
</style>
