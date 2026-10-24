<script setup>
import { ref, watch, onMounted } from 'vue';
import { Bell, UserPlus, UserCheck, CheckCheck } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useRealtimeStore } from '@/stores/realtime';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import ConnectButton from '@/components/ConnectButton.vue';
import ProfessionBadge from '@/components/ProfessionBadge.vue';

const auth = useAuthStore();
const realtime = useRealtimeStore();

const items = ref([]);
const hasMore = ref(false);
const loading = ref(true);
const loadingMore = ref(false);

const TEXT = {
  connection_request: 'wants to join your network',
  connection_accepted: 'accepted your invitation. Say hello!',
};
const ICON = { connection_request: UserPlus, connection_accepted: UserCheck };

async function markAllRead() {
  if (!auth.user?.unreadNotifications) return;
  auth.user.unreadNotifications = 0;
  await api.post('/notifications/read-all').catch(() => {});
}

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true;
  try {
    const { data } = await api.get('/notifications');
    items.value = data.items;
    hasMore.value = data.hasMore;
    markAllRead();
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  const last = items.value[items.value.length - 1];
  if (!last) return;
  loadingMore.value = true;
  try {
    const { data } = await api.get('/notifications', { params: { before: last.createdAt } });
    items.value.push(...data.items);
    hasMore.value = data.hasMore;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loadingMore.value = false;
  }
}

function onStatusChange(item, { status }) {
  item.actor.connectionStatus = status;
  auth.fetchMe().catch(() => {});
}

onMounted(load);
watch(() => realtime.networkVersion, () => load({ silent: true }));
watch(
  () => auth.user?.unreadNotifications,
  (n) => n && load({ silent: true }),
);
</script>

<template>
  <div class="container notifications">
    <header class="row-between">
      <div>
        <h1 class="page-title">Notifications</h1>
        <p class="muted">Invitations and updates from your network.</p>
      </div>
    </header>

    <UiCard :padded="false">
      <div v-if="loading" class="list">
        <div v-for="i in 5" :key="i" class="item">
          <UiSkeleton width="52px" height="52px" radius="50%" />
          <div class="stack grow" style="--gap: 8px">
            <UiSkeleton width="70%" height="14px" />
            <UiSkeleton width="30%" height="12px" />
          </div>
        </div>
      </div>

      <UiEmpty
        v-else-if="!items.length"
        :icon="Bell"
        title="You're all caught up"
        description="When someone invites you or accepts your invitation, it will show up here."
      >
        <UiButton to="/" variant="soft">Discover people</UiButton>
      </UiEmpty>

      <TransitionGroup v-else name="list" tag="ul" class="list">
        <li v-for="n in items" :key="n.id" class="item" :class="{ 'is-unread': !n.readAt }">
          <RouterLink :to="`/u/${n.actor.id}`" class="item__avatar">
            <UiAvatar :name="n.actor.name" :src="n.actor.avatarUrl" :size="52" />
            <span class="item__type" :class="`item__type--${n.type}`"><component :is="ICON[n.type]" /></span>
          </RouterLink>

          <div class="item__body">
            <p class="item__text">
              <RouterLink :to="`/u/${n.actor.id}`" class="item__name">{{ n.actor.name }}</RouterLink>
              {{ TEXT[n.type] }}
            </p>
            <div class="row wrap item__meta" style="--gap: 8px">
              <ProfessionBadge :profession="n.actor.profession" size="sm" />
              <span class="subtle">{{ timeAgo(n.createdAt) }}</span>
            </div>
          </div>

          <div class="item__actions">
            <ConnectButton
              v-if="n.type === 'connection_request' && n.actor.connectionStatus !== 'none'"
              :user="n.actor"
              size="sm"
              @change="onStatusChange(n, $event)"
            />
            <span v-else-if="n.type === 'connection_request'" class="subtle handled"><CheckCheck /> Handled</span>
            <UiButton v-else-if="n.actor.connectionStatus === 'connected'" size="sm" variant="soft" :to="`/messages/${n.actor.id}`">
              Message
            </UiButton>
          </div>
        </li>
      </TransitionGroup>

      <div v-if="hasMore" class="more">
        <UiButton variant="ghost" :loading="loadingMore" @click="loadMore">Load older notifications</UiButton>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.notifications {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 760px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 6px;
}
.item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: var(--radius);
  transition: background-color 0.2s var(--ease);
}
.item + .item {
  margin-top: 2px;
}
.item.is-unread {
  background: var(--primary-soft);
}
.item__avatar {
  position: relative;
  flex-shrink: 0;
}
.item__type {
  position: absolute;
  right: -4px;
  bottom: -4px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--surface);
  color: #fff;
}
.item__type svg {
  width: 13px;
  height: 13px;
}
.item__type--connection_request {
  background: var(--primary);
}
.item__type--connection_accepted {
  background: var(--success);
}
.item__body {
  flex: 1;
  min-width: 0;
}
.item__text {
  font-size: 0.94rem;
  color: var(--text-2);
}
.item__name {
  font-weight: 700;
  color: var(--text);
}
.item__name:hover {
  color: var(--primary);
}
.item__meta {
  margin-top: 6px;
  font-size: 0.8rem;
}
.item__actions {
  flex-shrink: 0;
}
.handled {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
}
.handled svg {
  width: 15px;
  height: 15px;
}
.more {
  display: flex;
  justify-content: center;
  padding: 8px 0 14px;
}
@media (max-width: 559px) {
  .item {
    flex-wrap: wrap;
  }
  .item__actions {
    width: 100%;
    padding-left: 66px;
  }
  .item__actions :deep(.connect) {
    width: 100%;
  }
  .item__actions :deep(.connect > *) {
    flex: 1;
  }
}
</style>
