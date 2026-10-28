<script setup>
import { ref, watch, onMounted } from 'vue';
import { Search, Users, ShieldHalf, Ban, ChevronLeft, ChevronRight, Crown } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import { formatDate } from '@/constants/plans';
import UiCard from '@/components/ui/UiCard.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import AdminUserSheet from './AdminUserSheet.vue';

const props = defineProps({ plans: { type: Array, default: () => [] } });
const emit = defineEmits(['changed']);

const filters = ref({ q: '', role: 'all', status: 'all', plan: 'all', sort: 'newest' });
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pages = ref(1);
const loading = ref(true);

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'member', label: 'Members' },
  { value: 'admin', label: 'Admins' },
];
const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'lastSeen', label: 'Recently active' },
];
const planOptions = () => [
  { value: 'all', label: 'Any plan' },
  ...props.plans.map((p) => ({ value: p.id, label: p.name })),
];

let requestId = 0;
async function load() {
  const id = ++requestId;
  loading.value = true;
  try {
    const { data } = await api.get('/admin/users', { params: { ...filters.value, page: page.value, limit: 20 } });
    if (id !== requestId) return;
    items.value = data.items;
    total.value = data.total;
    pages.value = data.pages;
  } catch (err) {
    if (id === requestId) toast.error(errorMessage(err));
  } finally {
    if (id === requestId) loading.value = false;
  }
}

let debounce;
watch(
  filters,
  () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      page.value = 1;
      load();
    }, 250);
  },
  { deep: true },
);
watch(page, load);
onMounted(load);

const sheetOpen = ref(false);
const selectedId = ref('');
function open(user) {
  selectedId.value = user.id;
  sheetOpen.value = true;
}
function onSaved() {
  load();
  emit('changed');
}
function onDeleted() {
  sheetOpen.value = false;
  load();
  emit('changed');
}
</script>

<template>
  <div class="stack" style="--gap: 14px">
    <div class="toolbar">
      <label class="search">
        <Search />
        <input v-model.trim="filters.q" type="search" placeholder="Search by name, email, phone or city" aria-label="Search users" />
      </label>
      <UiSelect v-model="filters.role" :options="ROLE_OPTIONS" aria-label="Role" />
      <UiSelect v-model="filters.status" :options="STATUS_OPTIONS" aria-label="Status" />
      <UiSelect v-model="filters.plan" :options="planOptions()" aria-label="Plan" />
      <UiSelect v-model="filters.sort" :options="SORT_OPTIONS" aria-label="Sort" />
    </div>

    <p class="muted results"><strong>{{ total }}</strong> {{ total === 1 ? 'account' : 'accounts' }}</p>

    <div v-if="loading && !items.length" class="stack" style="--gap: 8px">
      <UiSkeleton v-for="i in 6" :key="i" height="64px" />
    </div>

    <UiCard v-else-if="!items.length">
      <UiEmpty :icon="Users" title="No accounts match" description="Try another search or clear the filters." />
    </UiCard>

    <UiCard v-else :padded="false" class="table-card" :class="{ 'is-loading': loading }">
      <div class="table" role="table" aria-label="Users">
        <div class="row row--head" role="row">
          <span role="columnheader">Member</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Plan</span>
          <span role="columnheader" class="hide-sm">Activity</span>
          <span role="columnheader" class="hide-md">Joined</span>
        </div>
        <button v-for="u in items" :key="u.id" type="button" class="row" role="row" @click="open(u)">
          <span class="who" role="cell">
            <UiAvatar :name="u.name" :src="u.avatarUrl" :size="38" :online="u.isOnline && !u.suspendedAt" />
            <span class="who__text">
              <strong class="truncate">
                {{ u.name }}
                <ShieldHalf v-if="u.role === 'admin'" class="who__admin" aria-label="Admin" />
              </strong>
              <small class="truncate">{{ u.email }}</small>
            </span>
          </span>
          <span role="cell">
            <UiBadge v-if="u.suspendedAt" tone="danger" :icon="Ban">Suspended</UiBadge>
            <UiBadge v-else-if="u.role === 'admin'" tone="primary">Admin</UiBadge>
            <UiBadge v-else tone="success">Active</UiBadge>
          </span>
          <span role="cell" class="plan">
            <template v-if="u.plan">
              <span class="plan__name"><Crown /> {{ u.plan.name }}</span>
              <small v-if="u.planExpiresAt">until {{ formatDate(u.planExpiresAt) }}</small>
            </template>
            <span v-else class="subtle">No plan</span>
          </span>
          <span role="cell" class="hide-sm activity">
            <span>{{ u.connectionCount }} connections · {{ u.listingCount }} listings</span>
            <small>{{ u.isOnline ? 'Online now' : u.lastSeenAt ? `Seen ${timeAgo(u.lastSeenAt)}` : 'Never signed in' }}</small>
          </span>
          <span role="cell" class="hide-md subtle">{{ formatDate(u.createdAt) }}</span>
        </button>
      </div>
    </UiCard>

    <div v-if="pages > 1" class="pager">
      <UiButton variant="secondary" size="sm" :icon="ChevronLeft" :disabled="page <= 1 || loading" @click="page--">Previous</UiButton>
      <span class="muted">Page {{ page }} of {{ pages }}</span>
      <UiButton variant="secondary" size="sm" :icon-right="ChevronRight" :disabled="page >= pages || loading" @click="page++">Next</UiButton>
    </div>

    <AdminUserSheet v-model:open="sheetOpen" :user-id="selectedId" :plans="plans" @saved="onSaved" @deleted="onDeleted" />
  </div>
</template>

<style scoped>
.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}
.search {
  position: relative;
  display: flex;
  align-items: center;
}
.search svg {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: var(--text-3);
  pointer-events: none;
}
.search input {
  width: 100%;
  height: 44px;
  padding: 0 14px 0 42px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.92rem;
}
.search input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.results strong {
  color: var(--text);
}
.table-card {
  overflow: hidden;
  transition: opacity 0.2s;
}
.table-card.is-loading {
  opacity: 0.6;
}
.row {
  display: grid;
  grid-template-columns: minmax(0, 2.2fr) 110px minmax(0, 1.2fr);
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  border: 0;
  border-top: 1px solid var(--border);
  background: transparent;
  text-align: left;
  font-size: 0.88rem;
}
button.row:hover {
  background: var(--surface-2);
}
.row--head {
  border-top: 0;
  background: var(--surface-2);
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-3);
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.who__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.who__text strong {
  display: flex;
  align-items: center;
  gap: 6px;
}
.who__text small {
  color: var(--text-3);
}
.who__admin {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--primary);
}
.plan,
.activity {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.plan small,
.activity small {
  color: var(--text-3);
  font-size: 0.76rem;
}
.plan__name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.plan__name svg {
  width: 14px;
  height: 14px;
  color: var(--warning);
}
.hide-sm,
.hide-md {
  display: none;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

@media (min-width: 760px) {
  .toolbar {
    grid-template-columns: minmax(0, 1fr) repeat(4, 160px);
  }
  .row {
    grid-template-columns: minmax(0, 2.2fr) 110px minmax(0, 1.2fr) minmax(0, 1.4fr);
  }
  .hide-sm {
    display: flex;
    flex-direction: column;
  }
}
@media (min-width: 1100px) {
  .row {
    grid-template-columns: minmax(0, 2.2fr) 110px minmax(0, 1.2fr) minmax(0, 1.4fr) 120px;
  }
  .hide-md {
    display: block;
  }
}
</style>
