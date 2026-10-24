<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Inbox, Send, Users, Search, MessageCircle, UserPlus, Check, X, Undo2 } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useRealtimeStore } from '@/stores/realtime';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiTabs from '@/components/ui/UiTabs.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UserRow from '@/components/UserRow.vue';

const auth = useAuthStore();
const realtime = useRealtimeStore();

const tab = ref(auth.user?.pendingRequests ? 'invitations' : 'connections');
const incoming = ref([]);
const outgoing = ref([]);
const connections = ref([]);
const loading = ref(true);
const search = ref('');
const busy = ref({});

const filteredConnections = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return connections.value;
  return connections.value.filter((u) =>
    [u.name, u.roleTitle, u.city, u.profession].some((v) => v?.toLowerCase().includes(q)),
  );
});

const tabs = computed(() => [
  { key: 'invitations', label: 'Invitations', icon: Inbox, count: incoming.value.length },
  { key: 'connections', label: 'Connections', icon: Users },
  { key: 'sent', label: 'Sent', icon: Send },
]);

const sections = computed(() => [
  { key: 'connections', label: 'Connections', icon: Users, count: auth.user.connectionCount },
  { key: 'invitations', label: 'Invitations', icon: Inbox, count: incoming.value.length, hot: incoming.value.length > 0 },
  { key: 'sent', label: 'Sent', icon: Send, count: outgoing.value.length },
]);

const titles = {
  invitations: ['Invitations', 'People who want to join your network.'],
  connections: ['Connections', "Everyone you're connected with."],
  sent: ['Sent invitations', 'Invitations waiting for a reply.'],
};

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true;
  try {
    const [req, con] = await Promise.all([api.get('/connections/requests'), api.get('/connections')]);
    incoming.value = req.data.incoming;
    outgoing.value = req.data.outgoing;
    connections.value = con.data.items;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loading.value = false;
  }
}

async function act(key, fn, success) {
  busy.value = { ...busy.value, [key]: true };
  try {
    await fn();
    if (success) toast.success(success);
    await load({ silent: true });
    auth.fetchMe().catch(() => {});
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = { ...busy.value, [key]: false };
  }
}

const accept = (req) =>
  act(`a-${req.id}`, () => api.post(`/connections/requests/${req.id}/accept`), `You're now connected with ${req.user.name}`);
const decline = (req) => act(`d-${req.id}`, () => api.post(`/connections/requests/${req.id}/decline`));
const withdraw = (req) => act(`w-${req.id}`, () => api.delete(`/connections/${req.user.id}`), 'Invitation withdrawn');

onMounted(load);
watch(() => realtime.networkVersion, () => load({ silent: true }));
</script>

<template>
  <div class="container page-layout">
    <aside class="page-aside page-aside--sticky desktop-aside">
      <UiCard :padded="false">
        <header class="summary__head">
          <UiAvatar :name="auth.user.name" :src="auth.user.avatarUrl" :size="48" />
          <div class="grow" style="min-width: 0">
            <strong class="truncate" style="display: block">{{ auth.user.name }}</strong>
            <span class="muted" style="font-size: 0.84rem">Manage your network</span>
          </div>
        </header>
        <nav class="summary__nav" aria-label="Network sections">
          <button
            v-for="s in sections"
            :key="s.key"
            type="button"
            class="summary__item"
            :class="{ 'is-active': tab === s.key }"
            :aria-current="tab === s.key ? 'page' : undefined"
            @click="tab = s.key"
          >
            <span><component :is="s.icon" /> {{ s.label }}</span>
            <strong :class="{ hot: s.hot }">{{ s.count }}</strong>
          </button>
        </nav>
      </UiCard>

      <UiCard>
        <h2 class="section-title">Grow your network</h2>
        <p class="muted grow-text">Find doctors, developers, designers and more near you.</p>
        <UiButton to="/" variant="soft" block :icon="UserPlus">Discover people</UiButton>
      </UiCard>
    </aside>

    <section class="page-main">
      <header class="page-head">
        <div>
          <h1 class="page-title">{{ titles[tab][0] }}</h1>
          <p class="muted">{{ titles[tab][1] }}</p>
        </div>
      </header>

      <UiTabs v-model="tab" :tabs="tabs" class="mobile-tabs" />

      <UiCard>
        <div v-if="loading" class="stack" style="--gap: 18px">
          <div v-for="i in 4" :key="i" class="row" style="--gap: 12px">
            <UiSkeleton width="52px" height="52px" radius="50%" />
            <div class="stack grow" style="--gap: 8px">
              <UiSkeleton width="40%" height="14px" />
              <UiSkeleton width="65%" height="12px" />
            </div>
          </div>
        </div>

        <template v-else-if="tab === 'invitations'">
          <UiEmpty
            v-if="!incoming.length"
            :icon="Inbox"
            title="No pending invitations"
            description="When someone wants to connect, you'll see it here instantly."
          >
            <UiButton to="/" variant="soft" :icon="UserPlus">Find people</UiButton>
          </UiEmpty>
          <TransitionGroup v-else name="list" tag="div" class="rows">
            <UserRow
              v-for="req in incoming"
              :key="req.id"
              :user="req.user"
              :subtitle="`${req.user.connectionCount} connections · ${timeAgo(req.createdAt)}`"
              show-badge
            >
              <template #actions>
                <UiButton
                  variant="secondary"
                  size="sm"
                  :icon="X"
                  :loading="busy[`d-${req.id}`]"
                  :disabled="busy[`a-${req.id}`]"
                  @click="decline(req)"
                >
                  Ignore
                </UiButton>
                <UiButton
                  size="sm"
                  :icon="Check"
                  :loading="busy[`a-${req.id}`]"
                  :disabled="busy[`d-${req.id}`]"
                  @click="accept(req)"
                >
                  Accept
                </UiButton>
              </template>
            </UserRow>
          </TransitionGroup>
        </template>

        <template v-else-if="tab === 'sent'">
          <UiEmpty
            v-if="!outgoing.length"
            :icon="Send"
            title="No pending invitations sent"
            description="Invitations you send will wait here until they're accepted."
          />
          <TransitionGroup v-else name="list" tag="div" class="rows">
            <UserRow
              v-for="req in outgoing"
              :key="req.id"
              :user="req.user"
              :subtitle="`Sent ${timeAgo(req.createdAt)}`"
              show-badge
            >
              <template #actions>
                <UiButton variant="ghost" size="sm" :icon="Undo2" :loading="busy[`w-${req.id}`]" @click="withdraw(req)">
                  Withdraw
                </UiButton>
              </template>
            </UserRow>
          </TransitionGroup>
        </template>

        <template v-else>
          <UiEmpty
            v-if="!connections.length"
            :icon="Users"
            title="Your network is empty"
            description="Discover professionals nearby and send your first invitation."
          >
            <UiButton to="/" :icon="UserPlus">Discover people</UiButton>
          </UiEmpty>
          <template v-else>
            <UiInput
              v-model="search"
              :icon="Search"
              placeholder="Search your connections"
              type="search"
              aria-label="Search connections"
            />
            <p v-if="!filteredConnections.length" class="subtle no-match">No connections match "{{ search }}"</p>
            <TransitionGroup name="list" tag="div" class="rows rows--grid">
              <UserRow
                v-for="u in filteredConnections"
                :key="u.id"
                :user="u"
                :subtitle="`Connected ${timeAgo(u.connectedAt)}${u.city ? ' · ' + u.city : ''}`"
                show-badge
              >
                <template #actions>
                  <UiButton variant="soft" size="sm" :icon="MessageCircle" :to="`/messages/${u.id}`">Message</UiButton>
                </template>
              </UserRow>
            </TransitionGroup>
          </template>
        </template>
      </UiCard>
    </section>
  </div>
</template>

<style scoped>
.summary__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.summary__nav {
  display: flex;
  flex-direction: column;
  padding: 6px;
}
.summary__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.9rem;
  text-align: left;
  transition: background-color 0.15s var(--ease), color 0.15s var(--ease);
}
.summary__item:hover {
  background: var(--surface-2);
  color: var(--text);
}
.summary__item.is-active {
  background: var(--primary-soft);
  color: var(--primary);
}
.summary__item span {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.summary__item svg {
  width: 18px;
  height: 18px;
}
.summary__item strong {
  color: var(--primary);
}
.summary__item strong.hot {
  color: var(--danger);
}
.grow-text {
  font-size: 0.88rem;
  margin: 6px 0 14px;
}
.rows--grid {
  margin-top: 6px;
}
.no-match {
  padding: 24px 0 8px;
  text-align: center;
}

.desktop-aside {
  display: none;
}

@media (min-width: 1024px) {
  .desktop-aside {
    display: flex;
  }
  .mobile-tabs {
    display: none;
  }
}

/* Two columns of people on wide screens so rows don't stretch edge to edge. */
@media (min-width: 1360px) {
  .rows--grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 28px;
  }
  .rows--grid > :deep(.urow + .urow) {
    border-top: 0;
  }
  .rows--grid > :deep(.urow:nth-child(n + 3)) {
    border-top: 1px solid var(--border);
  }
}
</style>
