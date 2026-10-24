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
  <div class="container network">
    <header class="network__head">
      <div>
        <h1 class="page-title">My network</h1>
        <p class="muted">Manage invitations and the people you're connected with.</p>
      </div>
      <div class="summary">
        <div class="summary__item">
          <strong>{{ auth.user.connectionCount }}</strong>
          <span>Connections</span>
        </div>
        <div class="summary__item">
          <strong>{{ incoming.length }}</strong>
          <span>Invitations</span>
        </div>
        <div class="summary__item">
          <strong>{{ outgoing.length }}</strong>
          <span>Sent</span>
        </div>
      </div>
    </header>

    <UiTabs v-model="tab" :tabs="tabs" />

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
        <TransitionGroup v-else name="list" tag="div">
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
              <UiButton size="sm" :icon="Check" :loading="busy[`a-${req.id}`]" :disabled="busy[`d-${req.id}`]" @click="accept(req)">
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
        <TransitionGroup v-else name="list" tag="div">
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
          <UiInput v-model="search" :icon="Search" placeholder="Search your connections" type="search" aria-label="Search connections" />
          <p v-if="!filteredConnections.length" class="subtle no-match">No connections match "{{ search }}"</p>
          <TransitionGroup name="list" tag="div">
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
  </div>
</template>

<style scoped>
.network {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 880px;
}
.network__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.summary {
  display: flex;
  gap: 8px;
}
.summary__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 86px;
  padding: 10px 14px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}
.summary__item strong {
  font-size: 1.3rem;
  color: var(--primary);
  line-height: 1.2;
}
.summary__item span {
  font-size: 0.74rem;
  color: var(--text-2);
  font-weight: 600;
}
.no-match {
  padding: 24px 0 8px;
  text-align: center;
}
@media (max-width: 559px) {
  .summary {
    width: 100%;
  }
  .summary__item {
    flex: 1;
    min-width: 0;
  }
}
</style>
