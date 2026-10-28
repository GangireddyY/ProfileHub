<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Search,
  History,
  Download,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Ban,
  RotateCcw,
  Crown,
  Trash2,
  Pencil,
  ShieldHalf,
  Store,
  Flag,
  BriefcaseBusiness,
  Star,
  Send,
} from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { toast } from '@/composables/useToast';
import { downloadFromApi } from '@/utils/download';
import { timeAgo } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';

/** Admin audit log. With `targetId` it shows one account's history (used inside the user sheet). */
const props = defineProps({
  targetId: { type: String, default: '' },
  compact: Boolean,
});

const filters = ref({ q: '', targetType: 'all', adminId: '', action: '' });
const items = ref([]);
const admins = ref([]);
const total = ref(0);
const page = ref(1);
const pages = ref(1);
const loading = ref(true);
const exporting = ref(false);
const expanded = ref(new Set());

const { t } = useI18n();
const ta = (key) => t(`admin.activity.${key}`);
const TYPE_OPTIONS = computed(() =>
  ['all', 'user', 'listing', 'report', 'plan', 'profession', 'profession_request'].map((value) => ({ value, label: ta(`types.${value}`) })),
);

const ICONS = {
  'user.approved': UserCheck,
  'user.rejected': UserX,
  'user.suspended': Ban,
  'user.reactivated': RotateCcw,
  'user.plan_changed': Crown,
  'user.role_changed': ShieldHalf,
  'user.edited': Pencil,
  'user.deleted': Trash2,
  'plan_request.approved': Crown,
  'plan_request.rejected': Send,
  'listing.hidden': Store,
  'listing.restored': Store,
  'listing.deleted': Trash2,
  'review.deleted': Star,
};
const iconFor = (action) =>
  ICONS[action] ||
  (action.startsWith('report') ? Flag : action.startsWith('profession') ? BriefcaseBusiness : action.startsWith('plan') ? Crown : History);
const tone = (action) =>
  /deleted|suspended|rejected|hidden/.test(action) ? 'danger' : /approved|reactivated|restored|resolved|created/.test(action) ? 'success' : 'neutral';

const params = () => ({
  ...(props.targetId ? { targetId: props.targetId } : {}),
  q: filters.value.q || undefined,
  targetType: props.targetId ? undefined : filters.value.targetType,
  adminId: filters.value.adminId || undefined,
});

let requestId = 0;
async function load() {
  const id = ++requestId;
  loading.value = true;
  try {
    const { data } = await api.get('/admin/activity', { params: { ...params(), page: page.value, limit: props.compact ? 10 : 30 } });
    if (id !== requestId) return;
    items.value = data.items;
    admins.value = data.admins;
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
watch(() => props.targetId, () => {
  page.value = 1;
  load();
});
onMounted(load);

function toggleDetails(id) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

const fmt = (v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

async function exportCsv() {
  exporting.value = true;
  try {
    await downloadFromApi('/admin/activity/export.csv', params(), 'profilehub-admin-activity.csv');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    exporting.value = false;
  }
}

defineExpose({ reload: load });
</script>

<template>
  <div class="stack" style="--gap: 12px">
    <div v-if="!compact" class="toolbar">
      <label class="search">
        <Search />
        <input v-model.trim="filters.q" type="search" :placeholder="ta('searchPh')" :aria-label="ta('searchPh')" />
      </label>
      <UiSelect v-model="filters.targetType" :options="TYPE_OPTIONS" :aria-label="ta('types.all')" />
      <UiSelect
        v-model="filters.adminId"
        :options="[{ value: '', label: ta('allAdmins') }, ...admins.map((a) => ({ value: a.id, label: a.name }))]"
        :aria-label="ta('allAdmins')"
      />
      <UiButton variant="secondary" :icon="Download" :loading="exporting" :disabled="!total" @click="exportCsv">
        {{ t('admin.exportCsv') }}
      </UiButton>
    </div>

    <div v-if="loading && !items.length" class="stack" style="--gap: 8px">
      <UiSkeleton v-for="i in compact ? 3 : 6" :key="i" height="52px" />
    </div>

    <component :is="compact ? 'div' : UiCard" v-else-if="!items.length" class="empty-wrap">
      <UiEmpty
        :icon="History"
        compact
        :title="targetId ? ta('emptyMemberTitle') : ta('emptyTitle')"
        :description="targetId ? ta('emptyMemberText') : ta('emptyText')"
      />
    </component>

    <component :is="compact ? 'div' : UiCard" v-else :padded="compact ? undefined : false" class="log" :class="{ 'log--compact': compact, 'is-loading': loading }">
      <ol class="log__list">
        <li v-for="a in items" :key="a.id" class="entry">
          <span class="entry__icon" :class="`entry__icon--${tone(a.action)}`"><component :is="iconFor(a.action)" /></span>
          <div class="entry__body">
            <p class="entry__text">
              <strong>{{ a.adminName || ta('deletedAdmin') }}</strong>
              <span class="entry__summary">{{ a.summary || a.action }}</span>
            </p>
            <p class="entry__meta">
              <span v-if="!targetId && a.targetLabel" class="entry__target">{{ a.targetLabel }}</span>
              <time :datetime="a.createdAt" :title="new Date(a.createdAt).toLocaleString()">{{ timeAgo(a.createdAt) }}</time>
              <button v-if="a.data?.changes" type="button" class="entry__more" @click="toggleDetails(a.id)">
                {{ expanded.has(a.id) ? ta('hideDetails') : ta('details') }}
              </button>
            </p>
            <table v-if="expanded.has(a.id) && a.data?.changes" class="changes">
              <tbody>
                <tr v-for="(pair, field) in a.data.changes" :key="field">
                  <th>{{ field }}</th>
                  <td class="changes__old">{{ fmt(pair[0]) }}</td>
                  <td class="changes__new">{{ fmt(pair[1]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </li>
      </ol>
    </component>

    <div v-if="pages > 1" class="pager">
      <UiButton variant="secondary" size="sm" :icon="ChevronLeft" :disabled="page <= 1 || loading" @click="page--">
        {{ t('admin.pager.previous') }}
      </UiButton>
      <span class="muted">{{ t('admin.pager.page', { page, pages }) }}</span>
      <UiButton variant="secondary" size="sm" :icon-right="ChevronRight" :disabled="page >= pages || loading" @click="page++">
        {{ t('admin.pager.next') }}
      </UiButton>
    </div>
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
.log.is-loading {
  opacity: 0.6;
}
.log__list {
  list-style: none;
  margin: 0;
  padding: 6px 0;
}
.log--compact .log__list {
  padding: 0;
}
.entry {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
}
.entry:first-child {
  border-top: 0;
}
.log--compact .entry {
  padding: 10px 0;
}
.entry__icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--surface-3);
  color: var(--text-2);
}
.entry__icon--danger {
  background: var(--danger-soft);
  color: var(--danger);
}
.entry__icon--success {
  background: var(--success-soft, var(--primary-soft));
  color: var(--success);
}
.entry__icon svg {
  width: 16px;
  height: 16px;
}
.entry__body {
  flex: 1;
  min-width: 0;
}
.entry__text {
  font-size: 0.9rem;
}
.entry__summary {
  margin-left: 6px;
  color: var(--text-2);
}
.entry__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin-top: 2px;
  font-size: 0.78rem;
  color: var(--text-3);
}
.entry__target {
  font-weight: 600;
  color: var(--text-2);
}
.entry__more {
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary);
  font-weight: 600;
  font-size: 0.78rem;
}
.changes {
  width: 100%;
  margin-top: 8px;
  border-collapse: collapse;
  font-size: 0.78rem;
}
.changes th,
.changes td {
  padding: 5px 8px;
  border: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.changes th {
  width: 26%;
  font-weight: 600;
  background: var(--surface-2);
}
.changes__old {
  color: var(--danger);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--danger) 50%, transparent);
}
.changes__new {
  color: var(--success);
}
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
@media (min-width: 760px) {
  .toolbar {
    grid-template-columns: minmax(0, 1fr) 190px 170px auto;
  }
}
</style>
