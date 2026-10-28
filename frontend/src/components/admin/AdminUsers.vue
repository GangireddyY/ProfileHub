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
import { dialog } from '@/composables/useDialog';
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
const statusOf = (u) =>
  u.approvalStatus === 'pending'
    ? 'pending'
    : u.approvalStatus === 'rejected'
      ? 'rejected'
      : u.suspendedAt
        ? 'suspended'
        : u.role === 'admin'
          ? 'admin'
          : 'active';
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
    const note = await dialog.prompt({
      title: tu('declineTitle', { n }, n),
      label: tu('noteLabel'),
      multiline: true,
      maxLength: 300,
      confirmLabel: tu('decline'),
      tone: 'warning',
    });
    if (note === null) return;
    payload.note = note;
  } else if (action === 'delete') {
    const typed = await dialog.prompt({
      title: tu('deleteTitle', { n }, n),
      message: tu('deleteText'),
      match: 'DELETE',
      confirmLabel: tu('delete'),
      tone: 'danger',
    });
    if (typed !== 'DELETE') return;
  } else {
    const confirmed = await dialog.confirm({
      title: tu('bulkConfirm', { action: actionLabel, n }),
      confirmLabel: actionLabel,
      tone: action === 'suspend' ? 'block' : 'primary',
    });
    if (!confirmed) return;
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
  <div class="users">
    <section class="filters">
      <div class="filters__top">
        <label class="search">
          <Search />
          <input v-model.trim="filters.q" type="search" :placeholder="tu('searchPh')" :aria-label="tu('searchPh')" />
          <button v-if="filters.q" type="button" class="search__clear" :aria-label="t('common.clearSearch')" @click="filters.q = ''"><X /></button>
        </label>
        <div class="filters__selects">
          <UiSelect v-model="filters.role" :options="ROLE_OPTIONS" :aria-label="tu('col.member')" />
          <UiSelect v-model="filters.plan" :options="planOptions()" :aria-label="tu('col.plan')" />
          <UiSelect v-model="filters.sort" :options="SORT_OPTIONS" :aria-label="t('common.sortBy')" />
        </div>
      </div>
      <div class="chips" role="group" :aria-label="tu('col.status')">
        <button
          v-for="o in STATUS_OPTIONS"
          :key="o.value"
          type="button"
          class="chip"
          :class="[`chip--${o.value}`, { 'is-active': filters.status === o.value }]"
          :aria-pressed="filters.status === o.value"
          @click="filters.status = o.value"
        >
          <span class="chip__dot" />
          {{ o.label }}
        </button>
      </div>
    </section>

    <div class="results">
      <label v-if="items.length" class="pick-all" :title="tu('selectAll')">
        <input type="checkbox" :checked="allSelected" :indeterminate="selected.size > 0 && !allSelected" @change="toggleAll" />
        <span class="pick-all__text">{{ tu('selectAll') }}</span>
      </label>
      <span class="results__count">
        <Users />
        <strong>{{ countLabel }}</strong>
      </span>
      <UiButton class="results__export" size="sm" variant="secondary" :icon="Download" :loading="exporting" :disabled="!total" @click="exportCsv">
        {{ t('admin.exportCsv') }}
      </UiButton>
    </div>

    <Transition name="fade">
      <div v-if="selected.size" class="bulk" role="toolbar">
        <span class="bulk__count"><Check /> {{ tu('selected', { n: selected.size }) }}</span>
        <div class="bulk__group">
          <UiButton size="sm" variant="soft" :icon="Check" :loading="bulkBusy" @click="runBulk('approve')">{{ tu('approve') }}</UiButton>
          <UiButton size="sm" variant="secondary" :icon="X" :disabled="bulkBusy" @click="runBulk('reject')">{{ tu('decline') }}</UiButton>
          <UiButton size="sm" variant="secondary" :icon="Ban" :disabled="bulkBusy" @click="runBulk('suspend')">{{ tu('suspend') }}</UiButton>
          <UiButton size="sm" variant="secondary" :icon="RotateCcw" :disabled="bulkBusy" @click="runBulk('reactivate')">
            {{ tu('reactivate') }}
          </UiButton>
        </div>
        <span class="bulk__sep" aria-hidden="true" />
        <div class="bulk__group bulk__plan">
          <UiSelect
            v-model="bulkPlan"
            :options="[{ value: '', label: tu('changePlan') }, { value: 'default', label: tu('defaultPlan') }, ...plans.map((p) => ({ value: p.id, label: p.name }))]"
            :aria-label="tu('changePlan')"
          />
          <UiButton size="sm" variant="secondary" :icon="Crown" :disabled="!bulkPlan || bulkBusy" @click="runBulk('plan')">{{ tu('apply') }}</UiButton>
        </div>
        <div class="bulk__end">
          <UiButton size="sm" variant="danger" :icon="Trash2" :disabled="bulkBusy" @click="runBulk('delete')">{{ tu('delete') }}</UiButton>
          <button type="button" class="bulk__clear" :aria-label="tu('clearSelection')" :title="tu('clearSelection')" @click="selected = new Set()"><X /></button>
        </div>
      </div>
    </Transition>

    <div v-if="loading && !items.length" class="ugrid">
      <div v-for="i in 8" :key="i" class="ucard ucard--skeleton">
        <div class="ucard__banner" />
        <div class="ucard__body">
          <UiSkeleton width="72px" height="72px" radius="50%" class="ucard__skel-avatar" />
          <UiSkeleton width="60%" height="16px" />
          <UiSkeleton width="80%" height="12px" />
          <UiSkeleton width="100%" height="58px" radius="12px" class="ucard__skel-meta" />
        </div>
      </div>
    </div>

    <UiCard v-else-if="!items.length">
      <UiEmpty
        :icon="Users"
        :title="filters.status === 'pending' ? tu('emptyPendingTitle') : noFilters ? tu('emptyNoneTitle') : tu('emptyMatchTitle')"
        :description="filters.status === 'pending' ? tu('emptyPendingText') : noFilters ? tu('emptyNoneText') : tu('emptyMatchText')"
      />
    </UiCard>

    <div v-else class="ugrid" :class="{ 'is-loading': loading }">
      <article
        v-for="u in items"
        :key="u.id"
        class="ucard"
        :class="[`is-${statusOf(u)}`, { 'is-selected': selected.has(u.id) }]"
        tabindex="0"
        @click="open(u)"
        @keydown.enter="open(u)"
      >
        <div class="ucard__banner" />
        <label class="ucard__pick" :title="tu('select', { name: u.name })" @click.stop>
          <input type="checkbox" :checked="selected.has(u.id)" :aria-label="tu('select', { name: u.name })" @change="toggle(u.id)" />
        </label>
        <span class="ucard__status">
          <UiBadge v-if="statusOf(u) === 'pending'" tone="warning" :icon="Hourglass">{{ tu('badge.waiting') }}</UiBadge>
          <UiBadge v-else-if="statusOf(u) === 'rejected'" tone="neutral">{{ tu('badge.declined') }}</UiBadge>
          <UiBadge v-else-if="statusOf(u) === 'suspended'" tone="danger" :icon="Ban">{{ tu('badge.suspended') }}</UiBadge>
          <UiBadge v-else-if="statusOf(u) === 'admin'" tone="primary" :icon="ShieldHalf">{{ tu('badge.admin') }}</UiBadge>
          <UiBadge v-else tone="success">{{ tu('badge.active') }}</UiBadge>
        </span>

        <div class="ucard__body">
          <UiAvatar class="ucard__avatar" :name="u.name" :src="u.avatarUrl" :size="72" :online="u.isOnline && !u.suspendedAt" ring />
          <strong class="ucard__name" :title="u.name">
            <span class="truncate">{{ u.name }}</span>
          </strong>
          <small class="ucard__email" :title="u.email">
            <span class="truncate">{{ u.email }}</span>
            <MailCheck v-if="u.emailVerifiedAt" class="ucard__verified" :aria-label="tu('emailConfirmed')" />
          </small>
          <span class="ucard__role truncate">{{ [u.roleTitle, u.city].filter(Boolean).join(' · ') || '—' }}</span>

          <dl class="ucard__meta">
            <div class="ucard__plan">
              <dt>{{ tu('col.plan') }}</dt>
              <dd v-if="u.role === 'admin'">{{ tu('fullAccess') }}</dd>
              <dd v-else-if="u.plan" :title="u.planExpiresAt ? tu('until', { date: formatDate(u.planExpiresAt) }) : u.plan.name">
                <Crown /> <span class="truncate">{{ u.plan.name }}</span>
              </dd>
              <dd v-else class="is-none">{{ tu('noPlan') }}</dd>
            </div>
            <div>
              <dt>{{ t('discover.connections') }}</dt>
              <dd>{{ u.connectionCount }}</dd>
            </div>
            <div>
              <dt>{{ t('admin.sections.listings') }}</dt>
              <dd>{{ u.listingCount }}</dd>
            </div>
          </dl>
          <p v-if="u.planExpiresAt && u.role !== 'admin'" class="ucard__until">{{ tu('until', { date: formatDate(u.planExpiresAt) }) }}</p>
        </div>

        <footer class="ucard__foot">
          <span class="ucard__seen" :class="{ 'is-online': u.isOnline }">
            <span class="ucard__dot" />
            {{ u.isOnline ? tu('onlineNow') : u.lastSeenAt ? tu('seen', { time: timeAgo(u.lastSeenAt) }) : tu('neverSignedIn') }}
          </span>
          <span>{{ tu('col.joined') }} {{ formatDate(u.createdAt) }}</span>
        </footer>
      </article>
    </div>

    <nav v-if="pages > 1" class="pager" :aria-label="t('admin.pager.page', { page, pages })">
      <UiButton variant="secondary" size="sm" :icon="ChevronLeft" :disabled="page <= 1 || loading" @click="page--">
        {{ t('admin.pager.previous') }}
      </UiButton>
      <span class="pager__label">{{ t('admin.pager.page', { page, pages }) }}</span>
      <UiButton variant="secondary" size="sm" :icon-right="ChevronRight" :disabled="page >= pages || loading" @click="page++">
        {{ t('admin.pager.next') }}
      </UiButton>
    </nav>

    <AdminUserSheet v-model:open="sheetOpen" :user-id="selectedId" :plans="plans" @saved="onSaved" @deleted="onDeleted" />
  </div>
</template>

<style scoped>
.users {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- Filter panel ---------- */
.filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
}
.filters__top {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}
.filters__selects {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.filters__selects :deep(select) {
  height: 44px;
}
.search {
  position: relative;
  display: flex;
  align-items: center;
}
.search > svg {
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
  padding: 0 40px 0 42px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 0.92rem;
  transition: border-color 0.15s var(--ease), background-color 0.15s var(--ease), box-shadow 0.15s var(--ease);
}
.search input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: var(--ring);
}
.search input::-webkit-search-cancel-button {
  display: none;
}
.search__clear {
  position: absolute;
  right: 8px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
}
.search__clear:hover {
  background: var(--surface-3);
  color: var(--text);
}
.search__clear svg {
  width: 15px;
  height: 15px;
}

/* Status chips */
.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  margin: 0 -2px;
  padding: 2px;
}
.chips::-webkit-scrollbar {
  display: none;
}
.chip {
  --dot: var(--text-3);
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-size: 0.84rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background-color 0.15s var(--ease), border-color 0.15s var(--ease), color 0.15s var(--ease);
}
.chip:hover {
  border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
  color: var(--text);
}
.chip.is-active {
  border-color: var(--primary);
  background: var(--primary);
  color: #fff;
}
.chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dot);
}
.chip.is-active .chip__dot {
  background: #fff;
}
.chip--all .chip__dot {
  --dot: var(--primary);
}
.chip--pending {
  --dot: var(--warning);
}
.chip--active {
  --dot: var(--success);
}
.chip--suspended {
  --dot: var(--danger);
}

/* ---------- Results bar ---------- */
.results {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
}
.results__count {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--text-2);
}
.results__count svg {
  width: 17px;
  height: 17px;
  color: var(--primary);
}
.results__count strong {
  color: var(--text);
}
.results__export {
  margin-left: auto;
}
.pick-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-2);
  cursor: pointer;
}
.pick-all:hover {
  border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
}
input[type='checkbox'] {
  width: 17px;
  height: 17px;
  margin: 0;
  accent-color: var(--primary);
  cursor: pointer;
}

/* ---------- Bulk bar ---------- */
.bulk {
  position: sticky;
  top: calc(var(--nav-h) + 8px);
  z-index: 6;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
  background: color-mix(in srgb, var(--surface) 88%, var(--primary));
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
}
.bulk__count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-size: 0.84rem;
  font-weight: 700;
}
.bulk__count svg {
  width: 15px;
  height: 15px;
}
.bulk__group {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.bulk__sep {
  width: 1px;
  height: 24px;
  background: var(--border);
}
.bulk__plan :deep(select) {
  height: 34px;
  min-width: 150px;
}
.bulk__end {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.bulk__clear {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
}
.bulk__clear:hover {
  background: var(--surface-3);
  color: var(--text);
}
.bulk__clear svg {
  width: 16px;
  height: 16px;
}

/* ---------- Member cards ---------- */
.ugrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
  gap: 16px;
  transition: opacity 0.2s;
}
.ugrid.is-loading {
  opacity: 0.55;
  pointer-events: none;
}
.ucard {
  --tint: var(--primary);
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease), border-color 0.2s var(--ease);
}
.ucard.is-pending {
  --tint: var(--warning);
}
.ucard.is-suspended {
  --tint: var(--danger);
}
.ucard.is-rejected {
  --tint: var(--text-3);
}
.ucard.is-active {
  --tint: var(--success);
}
.ucard:not(.ucard--skeleton):hover,
.ucard:focus-visible {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
  border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
  outline: none;
}
.ucard.is-selected {
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.ucard--skeleton {
  cursor: default;
}
.ucard__banner {
  height: 64px;
  flex-shrink: 0;
  background:
    radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--tint) 26%, transparent), transparent 60%),
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, transparent), color-mix(in srgb, var(--accent) 10%, transparent));
}
.ucard__pick {
  position: absolute;
  top: 12px;
  left: 12px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--surface);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
}
.ucard__status {
  position: absolute;
  top: 14px;
  right: 12px;
}
.ucard__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 0 16px 14px;
  margin-top: -38px;
  text-align: center;
  flex: 1;
}
.ucard__avatar,
.ucard__skel-avatar {
  margin-bottom: 8px;
}
.ucard--skeleton .ucard__body {
  gap: 8px;
  padding-bottom: 16px;
}
.ucard__skel-meta {
  margin-top: 8px;
}
.ucard__name,
.ucard__email {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  max-width: 100%;
}
.ucard__name {
  font-size: 1rem;
  font-weight: 700;
}
.ucard__email {
  font-size: 0.78rem;
  color: var(--text-3);
}
.ucard__verified {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  color: var(--success);
}
.ucard__role {
  max-width: 100%;
  font-size: 0.8rem;
  color: var(--text-2);
}
.ucard__meta {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr);
  width: 100%;
  margin: 10px 0 0;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.ucard__meta > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  padding: 9px 6px;
}
.ucard__meta > div + div {
  border-left: 1px solid var(--border);
}
.ucard__meta dt {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-3);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ucard__meta dd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  max-width: 100%;
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.3;
}
.ucard__plan dd {
  font-size: 0.84rem;
  font-weight: 700;
}
.ucard__plan dd.is-none {
  color: var(--text-3);
  font-weight: 600;
}
.ucard__plan svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--warning);
}
.ucard__until {
  margin-top: 4px;
  font-size: 0.72rem;
  color: var(--text-3);
}
.ucard__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 0.74rem;
  color: var(--text-3);
}
.ucard__seen {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ucard__dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--text-3);
  opacity: 0.5;
}
.ucard__seen.is-online {
  color: var(--success);
  font-weight: 600;
}
.ucard__seen.is-online .ucard__dot {
  background: var(--success);
  opacity: 1;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 22%, transparent);
}

/* ---------- Pager ---------- */
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 4px;
}
.pager__label {
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-2);
}

@media (min-width: 900px) {
  .filters__top {
    grid-template-columns: minmax(0, 1fr) minmax(0, 520px);
  }
}
@media (max-width: 559px) {
  .filters__selects {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .filters__selects > :last-child {
    grid-column: 1 / -1;
  }
  .pick-all__text {
    display: none;
  }
  .bulk__sep {
    display: none;
  }
  .bulk__end {
    margin-left: 0;
  }
}
</style>

