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
import { useI18n } from 'vue-i18n';

const props = defineProps({
  plans: { type: Array, default: () => [] },
  /** e.g. 'pending' for the Approvals tab. */
  initialStatus: { type: String, default: 'all' },
});
const emit = defineEmits(['changed']);

const filters = ref({ q: '', role: 'member', status: props.initialStatus, plan: 'all', sort: props.initialStatus === 'pending' ? 'oldest' : 'newest' });
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pages = ref(1);
const loading = ref(true);

const { t } = useI18n();
const tu = (key, params, n) => (n === undefined ? t(`admin.users.${key}`, params ?? {}) : t(`admin.users.${key}`, params ?? {}, n));
const options = (group, values) => computed(() => values.map((value) => ({ value, label: tu(`${group}.${value}`) })));
const ROLE_OPTIONS = options('role', ['member', 'admin', 'all']);
const STATUS_OPTIONS = options('status', ['all', 'pending', 'active', 'suspended', 'rejected']);
const SORT_OPTIONS = options('sort', ['newest', 'oldest', 'name', 'lastSeen']);
const noFilters = computed(
  () => !filters.value.q && filters.value.role === 'member' && filters.value.status === 'all' && filters.value.plan === 'all',
);
const planOptions = () => [
  { value: 'all', label: tu('anyPlan') },
  ...props.plans.map((p) => ({ value: p.id, label: p.name })),
];
const countLabel = computed(() => {
  const key = filters.value.role === 'member' ? 'countMembers' : filters.value.role === 'admin' ? 'countAdmins' : 'countAccounts';
  return tu(key, { n: total.value }, total.value);
});

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
const BULK_LABELS = { approve: 'approve', reject: 'decline', suspend: 'suspend', reactivate: 'reactivate', plan: 'apply', delete: 'delete' };

async function runBulk(action) {
  const ids = [...selected.value];
  if (!ids.length) return;
  const n = ids.length;
  const actionLabel = action === 'plan' ? tu('changePlan').replace('…', '') : tu(BULK_LABELS[action]);
  const payload = { ids, action };
  if (action === 'plan') {
    if (!bulkPlan.value) return;
    payload.planId = bulkPlan.value === 'default' ? null : bulkPlan.value;
  }
  if (action === 'reject') {
    const note = window.prompt(tu('declinePrompt', { n }), '');
    if (note === null) return;
    payload.note = note;
  } else if (action === 'delete') {
    if (window.prompt(tu('deletePrompt', { n })) !== 'DELETE') return;
  } else if (!window.confirm(tu('bulkConfirm', { action: actionLabel, n }))) {
    return;
  }
  bulkBusy.value = true;
  try {
    const { data } = await api.post('/admin/users/bulk', payload);
    if (data.done) toast.success(tu('bulkDone', { action: actionLabel, n: data.done }));
    if (data.failed.length) {
      toast.error(data.failed.map((f) => `${f.name}: ${f.message}`).slice(0, 4).join(' · '), {
        title: tu('bulkFailed', { n: data.failed.length }),
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
        <input v-model.trim="filters.q" type="search" :placeholder="tu('searchPh')" :aria-label="tu('searchPh')" />
      </label>
      <UiSelect v-model="filters.role" :options="ROLE_OPTIONS" :aria-label="tu('col.member')" />
      <UiSelect v-model="filters.status" :options="STATUS_OPTIONS" :aria-label="tu('col.status')" />
      <UiSelect v-model="filters.plan" :options="planOptions()" :aria-label="tu('col.plan')" />
      <UiSelect v-model="filters.sort" :options="SORT_OPTIONS" :aria-label="t('common.sortBy')" />
    </div>

    <div class="results">
      <p class="muted"><strong>{{ countLabel }}</strong></p>
      <UiButton size="sm" variant="ghost" :icon="Download" :loading="exporting" :disabled="!total" @click="exportCsv">
        {{ t('admin.exportCsv') }}
      </UiButton>
    </div>

    <Transition name="fade">
      <div v-if="selected.size" class="bulk" role="toolbar">
        <strong>{{ tu('selected', { n: selected.size }) }}</strong>
        <UiButton size="sm" variant="soft" :icon="Check" :loading="bulkBusy" @click="runBulk('approve')">{{ tu('approve') }}</UiButton>
        <UiButton size="sm" variant="secondary" :icon="X" :disabled="bulkBusy" @click="runBulk('reject')">{{ tu('decline') }}</UiButton>
        <UiButton size="sm" variant="secondary" :icon="Ban" :disabled="bulkBusy" @click="runBulk('suspend')">{{ tu('suspend') }}</UiButton>
        <UiButton size="sm" variant="secondary" :icon="RotateCcw" :disabled="bulkBusy" @click="runBulk('reactivate')">
          {{ tu('reactivate') }}
        </UiButton>
        <span class="bulk__plan">
          <UiSelect
            v-model="bulkPlan"
            :options="[{ value: '', label: tu('changePlan') }, { value: 'default', label: tu('defaultPlan') }, ...plans.map((p) => ({ value: p.id, label: p.name }))]"
            :aria-label="tu('changePlan')"
          />
          <UiButton size="sm" variant="secondary" :icon="Crown" :disabled="!bulkPlan || bulkBusy" @click="runBulk('plan')">{{ tu('apply') }}</UiButton>
        </span>
        <UiButton size="sm" variant="danger" :icon="Trash2" :disabled="bulkBusy" @click="runBulk('delete')">{{ tu('delete') }}</UiButton>
        <button type="button" class="bulk__clear" :aria-label="tu('clearSelection')" @click="selected = new Set()"><X /></button>
      </div>
    </Transition>

    <div v-if="loading && !items.length" class="stack" style="--gap: 8px">
      <UiSkeleton v-for="i in 6" :key="i" height="64px" />
    </div>

    <UiCard v-else-if="!items.length">
      <UiEmpty
        :icon="Users"
        :title="filters.status === 'pending' ? tu('emptyPendingTitle') : noFilters ? tu('emptyNoneTitle') : tu('emptyMatchTitle')"
        :description="filters.status === 'pending' ? tu('emptyPendingText') : noFilters ? tu('emptyNoneText') : tu('emptyMatchText')"
      />
    </UiCard>

    <UiCard v-else :padded="false" class="table-card" :class="{ 'is-loading': loading }">
      <div class="table" role="table">
        <div class="row row--head" role="row">
          <span role="columnheader" class="pick">
            <input type="checkbox" :checked="allSelected" :aria-label="tu('selectAll')" @change="toggleAll" />
          </span>
          <span role="columnheader">{{ tu('col.member') }}</span>
          <span role="columnheader">{{ tu('col.status') }}</span>
          <span role="columnheader">{{ tu('col.plan') }}</span>
          <span role="columnheader" class="hide-sm">{{ tu('col.activity') }}</span>
          <span role="columnheader" class="hide-md">{{ tu('col.joined') }}</span>
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
            <input type="checkbox" :checked="selected.has(u.id)" :aria-label="tu('select', { name: u.name })" @change="toggle(u.id)" />
          </span>
          <span class="who" role="cell">
            <UiAvatar :name="u.name" :src="u.avatarUrl" :size="38" :online="u.isOnline && !u.suspendedAt" />
            <span class="who__text">
              <strong class="truncate">
                {{ u.name }}
                <ShieldHalf v-if="u.role === 'admin'" class="who__admin" :aria-label="tu('badge.admin')" />
              </strong>
              <small class="truncate">
                {{ u.email }}
                <MailCheck v-if="u.emailVerifiedAt" class="who__verified" :aria-label="tu('emailConfirmed')" />
              </small>
            </span>
          </span>
          <span role="cell">
            <UiBadge v-if="u.approvalStatus === 'pending'" tone="warning" :icon="Hourglass">{{ tu('badge.waiting') }}</UiBadge>
            <UiBadge v-else-if="u.approvalStatus === 'rejected'" tone="neutral">{{ tu('badge.declined') }}</UiBadge>
            <UiBadge v-else-if="u.suspendedAt" tone="danger" :icon="Ban">{{ tu('badge.suspended') }}</UiBadge>
            <UiBadge v-else-if="u.role === 'admin'" tone="primary">{{ tu('badge.admin') }}</UiBadge>
            <UiBadge v-else tone="success">{{ tu('badge.active') }}</UiBadge>
          </span>
          <span role="cell" class="plan">
            <span v-if="u.role === 'admin'" class="subtle">{{ tu('fullAccess') }}</span>
            <template v-else-if="u.plan">
              <span class="plan__name"><Crown /> {{ u.plan.name }}</span>
              <small v-if="u.planExpiresAt">{{ tu('until', { date: formatDate(u.planExpiresAt) }) }}</small>
            </template>
            <span v-else class="subtle">{{ tu('noPlan') }}</span>
          </span>
          <span role="cell" class="hide-sm activity">
            <span>{{ tu('activity', { c: u.connectionCount, l: u.listingCount }) }}</span>
            <small>{{ u.isOnline ? tu('onlineNow') : u.lastSeenAt ? tu('seen', { time: timeAgo(u.lastSeenAt) }) : tu('neverSignedIn') }}</small>
          </span>
          <span role="cell" class="hide-md subtle">{{ formatDate(u.createdAt) }}</span>
        </div>
      </div>
    </UiCard>

    <div v-if="pages > 1" class="pager">
      <UiButton variant="secondary" size="sm" :icon="ChevronLeft" :disabled="page <= 1 || loading" @click="page--">
        {{ t('admin.pager.previous') }}
      </UiButton>
      <span class="muted">{{ t('admin.pager.page', { page, pages }) }}</span>
      <UiButton variant="secondary" size="sm" :icon-right="ChevronRight" :disabled="page >= pages || loading" @click="page++">
        {{ t('admin.pager.next') }}
      </UiButton>
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
