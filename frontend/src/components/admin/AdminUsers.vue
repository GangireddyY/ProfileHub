<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import {
  Search,
  Users,
  ShieldHalf,
  Ban,
  ChevronLeft,
  ChevronRight,
  Crown,
  Hourglass,
  Download,
  Check,
  X,
  RotateCcw,
  Trash2,
  MailCheck,
} from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { downloadFromApi } from '@/utils/download';
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

const props = defineProps({
  plans: { type: Array, default: () => [] },
  /** e.g. 'pending' for the Approvals tab. */
  initialStatus: { type: String, default: 'all' },
});
const emit = defineEmits(['changed']);

const filters = ref({ q: '', role: 'all', status: props.initialStatus, plan: 'all', sort: props.initialStatus === 'pending' ? 'oldest' : 'newest' });
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
  { value: 'pending', label: 'Waiting for approval' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Declined' },
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

// ---------- Selection & bulk actions ----------
const selected = ref(new Set());
const allSelected = computed(() => items.value.length > 0 && items.value.every((u) => selected.value.has(u.id)));
watch(items, (list) => {
  const visible = new Set(list.map((u) => u.id));
  selected.value = new Set([...selected.value].filter((id) => visible.has(id)));
});
function toggle(id) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = next;
}
function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(items.value.map((u) => u.id));
}

const bulkBusy = ref(false);
const bulkPlan = ref('');
const BULK_LABELS = {
  approve: 'Approve',
  reject: 'Decline',
  suspend: 'Suspend',
  reactivate: 'Reactivate',
  plan: 'Change plan of',
  delete: 'Permanently delete',
};

async function runBulk(action) {
  const ids = [...selected.value];
  if (!ids.length) return;
  const count = `${ids.length} account${ids.length === 1 ? '' : 's'}`;
  const payload = { ids, action };
  if (action === 'plan') {
    if (!bulkPlan.value) return;
    payload.planId = bulkPlan.value === 'default' ? null : bulkPlan.value;
  }
  if (action === 'reject') {
    const note = window.prompt(`Decline ${count}? Optional note for the members:`, '');
    if (note === null) return;
    payload.note = note;
  } else if (action === 'delete') {
    if (window.prompt(`Permanently delete ${count} and everything they own? Type DELETE to confirm.`) !== 'DELETE') return;
  } else if (!window.confirm(`${BULK_LABELS[action]} ${count}?`)) {
    return;
  }
  bulkBusy.value = true;
  try {
    const { data } = await api.post('/admin/users/bulk', payload);
    if (data.done) toast.success(`${BULK_LABELS[action]}: ${data.done} done`);
    if (data.failed.length) {
      toast.error(data.failed.map((f) => `${f.name}: ${f.message}`).slice(0, 4).join(' · '), {
        title: `${data.failed.length} could not be changed`,
      });
    }
    selected.value = new Set();
    bulkPlan.value = '';
    load();
    emit('changed');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    bulkBusy.value = false;
  }
}

const exporting = ref(false);
async function exportCsv() {
  exporting.value = true;
  try {
    const { q, role, status, plan, sort } = filters.value;
    await downloadFromApi('/admin/users/export.csv', { q: q || undefined, role, status, plan, sort }, 'profilehub-users.csv');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    exporting.value = false;
  }
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

    <div class="results">
      <p class="muted"><strong>{{ total }}</strong> {{ total === 1 ? 'account' : 'accounts' }}</p>
      <UiButton size="sm" variant="ghost" :icon="Download" :loading="exporting" :disabled="!total" @click="exportCsv">Export CSV</UiButton>
    </div>

    <Transition name="fade">
      <div v-if="selected.size" class="bulk" role="toolbar" aria-label="Bulk actions">
        <strong>{{ selected.size }} selected</strong>
        <UiButton size="sm" variant="soft" :icon="Check" :loading="bulkBusy" @click="runBulk('approve')">Approve</UiButton>
        <UiButton size="sm" variant="secondary" :icon="X" :disabled="bulkBusy" @click="runBulk('reject')">Decline</UiButton>
        <UiButton size="sm" variant="secondary" :icon="Ban" :disabled="bulkBusy" @click="runBulk('suspend')">Suspend</UiButton>
        <UiButton size="sm" variant="secondary" :icon="RotateCcw" :disabled="bulkBusy" @click="runBulk('reactivate')">Reactivate</UiButton>
        <span class="bulk__plan">
          <UiSelect
            v-model="bulkPlan"
            :options="[{ value: '', label: 'Change plan…' }, { value: 'default', label: 'Default plan' }, ...plans.map((p) => ({ value: p.id, label: p.name }))]"
            aria-label="Plan for the selected accounts"
          />
          <UiButton size="sm" variant="secondary" :icon="Crown" :disabled="!bulkPlan || bulkBusy" @click="runBulk('plan')">Apply</UiButton>
        </span>
        <UiButton size="sm" variant="danger" :icon="Trash2" :disabled="bulkBusy" @click="runBulk('delete')">Delete</UiButton>
        <button type="button" class="bulk__clear" aria-label="Clear selection" @click="selected = new Set()"><X /></button>
      </div>
    </Transition>

    <div v-if="loading && !items.length" class="stack" style="--gap: 8px">
      <UiSkeleton v-for="i in 6" :key="i" height="64px" />
    </div>

    <UiCard v-else-if="!items.length">
      <UiEmpty
        :icon="Users"
        :title="filters.status === 'pending' ? 'Nobody is waiting for approval' : 'No accounts match'"
        :description="filters.status === 'pending' ? 'New sign-ups appear here until an admin approves or declines them.' : 'Try another search or clear the filters.'"
      />
    </UiCard>

    <UiCard v-else :padded="false" class="table-card" :class="{ 'is-loading': loading }">
      <div class="table" role="table" aria-label="Users">
        <div class="row row--head" role="row">
          <span role="columnheader" class="pick">
            <input type="checkbox" :checked="allSelected" aria-label="Select all on this page" @change="toggleAll" />
          </span>
          <span role="columnheader">Member</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Plan</span>
          <span role="columnheader" class="hide-sm">Activity</span>
          <span role="columnheader" class="hide-md">Joined</span>
        </div>
        <div
          v-for="u in items"
          :key="u.id"
          class="row row--item"
          :class="{ 'is-selected': selected.has(u.id) }"
          role="row"
          tabindex="0"
          @click="open(u)"
          @keydown.enter="open(u)"
        >
          <span class="pick" role="cell" @click.stop>
            <input type="checkbox" :checked="selected.has(u.id)" :aria-label="`Select ${u.name}`" @change="toggle(u.id)" />
          </span>
          <span class="who" role="cell">
            <UiAvatar :name="u.name" :src="u.avatarUrl" :size="38" :online="u.isOnline && !u.suspendedAt" />
            <span class="who__text">
              <strong class="truncate">
                {{ u.name }}
                <ShieldHalf v-if="u.role === 'admin'" class="who__admin" aria-label="Admin" />
              </strong>
              <small class="truncate">
                {{ u.email }}
                <MailCheck v-if="u.emailVerifiedAt" class="who__verified" aria-label="Email confirmed" />
              </small>
            </span>
          </span>
          <span role="cell">
            <UiBadge v-if="u.approvalStatus === 'pending'" tone="warning" :icon="Hourglass">Waiting</UiBadge>
            <UiBadge v-else-if="u.approvalStatus === 'rejected'" tone="neutral">Declined</UiBadge>
            <UiBadge v-else-if="u.suspendedAt" tone="danger" :icon="Ban">Suspended</UiBadge>
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
        </div>
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
.results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.results strong {
  color: var(--text);
}
.bulk {
  position: sticky;
  top: calc(var(--nav-h) + 8px);
  z-index: 5;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
  background: var(--primary-soft);
  box-shadow: var(--shadow-sm);
}
.bulk > strong {
  margin-right: 4px;
  font-size: 0.88rem;
}
.bulk__plan {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.bulk__plan :deep(select) {
  height: 34px;
  min-width: 150px;
}
.bulk__clear {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-left: auto;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
}
.bulk__clear svg {
  width: 16px;
  height: 16px;
}
.pick {
  display: grid;
  place-items: center;
}
.pick input {
  width: 17px;
  height: 17px;
  accent-color: var(--primary);
  cursor: pointer;
}
.row--item {
  cursor: pointer;
}
.row--item.is-selected {
  background: var(--primary-soft);
}
.who__verified {
  display: inline;
  width: 12px;
  height: 12px;
  margin-left: 4px;
  vertical-align: -1px;
  color: var(--success);
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
  grid-template-columns: 28px minmax(0, 2.2fr) 110px minmax(0, 1.2fr);
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
.row--item:hover {
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
    grid-template-columns: 28px minmax(0, 2.2fr) 110px minmax(0, 1.2fr) minmax(0, 1.4fr);
  }
  .hide-sm {
    display: flex;
    flex-direction: column;
  }
}
@media (min-width: 1100px) {
  .row {
    grid-template-columns: 28px minmax(0, 2.2fr) 110px minmax(0, 1.2fr) minmax(0, 1.4fr) 120px;
  }
  .hide-md {
    display: block;
  }
}
</style>
