<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  ShieldHalf,
  Users,
  Hourglass,
  BriefcaseBusiness,
  Store,
  HardHat,
  Check,
  X,
  Plus,
  Pencil,
  Search,
  Inbox,
  Flame,
  Crown,
  Ban,
  Send,
} from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { useProfessionsStore } from '@/stores/professions';
import { toast } from '@/composables/useToast';
import { iconFor } from '@/constants/professions';
import { timeAgo } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTabs from '@/components/ui/UiTabs.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiToggle from '@/components/ui/UiToggle.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import ProfessionBadge from '@/components/ProfessionBadge.vue';
import ProfessionForm from '@/components/admin/ProfessionForm.vue';
import BackButton from '@/components/BackButton.vue';
import AdminUsers from '@/components/admin/AdminUsers.vue';
import AdminPlans from '@/components/admin/AdminPlans.vue';
import AdminPlanRequests from '@/components/admin/AdminPlanRequests.vue';

const store = useProfessionsStore();

const route = useRoute();
const TAB_KEYS = ['users', 'plans', 'plan-requests', 'requests', 'catalog'];
// Notifications link straight to a tab, e.g. /admin?tab=plan-requests.
const tab = ref(TAB_KEYS.includes(route.query.tab) ? route.query.tab : 'users');
watch(
  () => route.query.tab,
  (t) => TAB_KEYS.includes(t) && (tab.value = t),
);
const stats = ref(null);

const plans = ref([]);
const loadingPlans = ref(true);
async function loadPlans() {
  try {
    plans.value = (await api.get('/admin/plans')).data.items;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loadingPlans.value = false;
  }
}
function onAccountsChanged() {
  loadStats();
  loadPlans();
}

async function loadStats() {
  try {
    stats.value = (await api.get('/admin/stats')).data;
  } catch {
    /* cards only */
  }
}

const statCards = computed(() => [
  { label: 'Members', value: stats.value?.users, icon: Users },
  { label: 'On a paid plan', value: stats.value?.subscribers, icon: Crown },
  {
    label: 'Plan requests',
    value: stats.value?.pendingPlanRequests,
    icon: Send,
    hot: stats.value?.pendingPlanRequests > 0,
  },
  { label: 'Suspended', value: stats.value?.suspended, icon: Ban, hot: stats.value?.suspended > 0 },
  { label: 'Profession requests', value: stats.value?.pendingRequests, icon: Hourglass, hot: stats.value?.pendingRequests > 0 },
  { label: 'Professions', value: stats.value?.professions, icon: BriefcaseBusiness },
  { label: 'Active listings', value: stats.value?.activeListings, icon: Store },
  { label: 'Open to work', value: stats.value?.availableWorkers, icon: HardHat },
]);
const tabs = computed(() => [
  { key: 'users', label: 'Users', icon: Users, count: stats.value?.users || undefined },
  { key: 'plans', label: 'Plans', icon: Crown, count: plans.value.length || undefined },
  { key: 'plan-requests', label: 'Plan requests', icon: Send, count: stats.value?.pendingPlanRequests || undefined },
  { key: 'requests', label: 'Profession requests', icon: Inbox, count: stats.value?.pendingRequests || undefined },
  { key: 'catalog', label: 'Profession list', icon: BriefcaseBusiness },
]);

// ---------- Requests ----------
const status = ref('pending');
const requests = ref([]);
const loadingRequests = ref(true);
const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
  { value: 'all', label: 'All' },
];

async function loadRequests() {
  loadingRequests.value = true;
  try {
    requests.value = (await api.get('/admin/profession-requests', { params: { status: status.value } })).data.items;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loadingRequests.value = false;
  }
}
watch(status, loadRequests);

const approveOpen = ref(false);
const approving = ref(null);
const approveForm = ref({ label: '', category: 'other', icon: 'Briefcase', hue: 220 });
const assign = ref(true);
const approveErrors = ref({});
const busy = ref(false);

function openApprove(r) {
  const c = store.category(r.category);
  approving.value = r;
  approveForm.value = { label: r.label, category: r.category, icon: c.iconName || 'Briefcase', hue: c.hue };
  assign.value = true;
  approveErrors.value = {};
  approveOpen.value = true;
}

async function approve() {
  busy.value = true;
  approveErrors.value = {};
  try {
    const { data } = await api.post(`/admin/profession-requests/${approving.value.id}/approve`, {
      ...approveForm.value,
      assign: assign.value,
    });
    toast.success(
      data.resolved > 1
        ? `“${data.profession.label}” added. ${data.resolved} matching requests were resolved.`
        : `“${data.profession.label}” added to the list`,
    );
    approveOpen.value = false;
    store.refresh().catch(() => {});
    loadRequests();
    loadStats();
    if (catalogLoaded.value) loadCatalog();
  } catch (err) {
    approveErrors.value = fieldErrors(err);
    toast.error(errorMessage(err));
  } finally {
    busy.value = false;
  }
}

const rejectOpen = ref(false);
const rejecting = ref(null);
const rejectNote = ref('');

function openReject(r) {
  rejecting.value = r;
  rejectNote.value = '';
  rejectOpen.value = true;
}

async function reject() {
  busy.value = true;
  try {
    await api.post(`/admin/profession-requests/${rejecting.value.id}/reject`, { note: rejectNote.value });
    toast.info(`Request for “${rejecting.value.label}” declined`);
    rejectOpen.value = false;
    loadRequests();
    loadStats();
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = false;
  }
}

// ---------- Catalog ----------
const catalog = ref([]);
const catalogLoaded = ref(false);
const loadingCatalog = ref(false);
const catalogQuery = ref('');
const catalogCategory = ref('');
const showInactive = ref(false);
const categoryOptions = computed(() => [{ value: '', label: 'All categories' }, ...store.categories.map((c) => ({ value: c.key, label: c.label }))]);

const filteredCatalog = computed(() => {
  const q = catalogQuery.value.trim().toLowerCase();
  return catalog.value.filter(
    (p) =>
      (showInactive.value || p.active) &&
      (!catalogCategory.value || p.category === catalogCategory.value) &&
      (!q || p.label.toLowerCase().includes(q) || p.key.includes(q)),
  );
});

async function loadCatalog() {
  loadingCatalog.value = true;
  try {
    catalog.value = (await api.get('/admin/professions')).data.items;
    catalogLoaded.value = true;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loadingCatalog.value = false;
  }
}
watch(tab, (t) => t === 'catalog' && !catalogLoaded.value && loadCatalog());

const editOpen = ref(false);
const editing = ref(null);
const editForm = ref({ label: '', category: 'other', icon: 'Briefcase', hue: 220 });
const editErrors = ref({});

function openEdit(p) {
  editing.value = p;
  editErrors.value = {};
  if (p) editForm.value = { label: p.label, category: p.category, icon: p.icon, hue: p.hue };
  else {
    const c = store.category(catalogCategory.value || 'other');
    editForm.value = { label: catalogQuery.value.trim(), category: c.key, icon: c.iconName || 'Briefcase', hue: c.hue };
  }
  editOpen.value = true;
}

async function saveProfession() {
  busy.value = true;
  editErrors.value = {};
  try {
    if (editing.value) {
      await api.patch(`/admin/professions/${editing.value.key}`, editForm.value);
      toast.success('Profession updated');
    } else {
      await api.post('/admin/professions', editForm.value);
      toast.success(`“${editForm.value.label}” added`);
    }
    editOpen.value = false;
    store.refresh().catch(() => {});
    loadCatalog();
    loadStats();
  } catch (err) {
    editErrors.value = fieldErrors(err);
    toast.error(errorMessage(err));
  } finally {
    busy.value = false;
  }
}

async function toggleActive(p) {
  const next = !p.active;
  p.active = next;
  try {
    await api.patch(`/admin/professions/${p.key}`, { active: next });
    toast.success(next ? `“${p.label}” is visible again` : `“${p.label}” hidden from pickers`);
    store.refresh().catch(() => {});
    loadStats();
  } catch (err) {
    p.active = !next;
    toast.error(errorMessage(err));
  }
}

onMounted(() => {
  loadStats();
  loadPlans();
  loadRequests();
  if (tab.value === 'catalog') loadCatalog();
});
</script>

<template>
  <div class="container admin">
    <BackButton />
    <header class="page-head">
      <div class="row" style="--gap: 14px">
        <span class="head-icon"><ShieldHalf /></span>
        <div>
          <h1 class="page-title">Admin panel</h1>
          <p class="muted">Manage every account and plan, review profession requests and keep the profession list tidy.</p>
        </div>
      </div>
    </header>

    <div class="stats">
      <div v-for="s in statCards" :key="s.label" class="stat" :class="{ 'is-hot': s.hot }">
        <span class="stat__icon"><component :is="s.icon" /></span>
        <div>
          <strong v-if="stats">{{ s.value ?? 0 }}</strong>
          <UiSkeleton v-else width="36px" height="22px" />
          <span>{{ s.label }}</span>
        </div>
      </div>
    </div>

    <UiTabs v-model="tab" :tabs="tabs" />

    <AdminUsers v-if="tab === 'users'" :plans="plans" @changed="onAccountsChanged" />
    <AdminPlans v-else-if="tab === 'plans'" :plans="plans" :loading="loadingPlans" @changed="onAccountsChanged" />
    <AdminPlanRequests v-else-if="tab === 'plan-requests'" @changed="onAccountsChanged" />

    <!-- Requests -->
    <template v-else-if="tab === 'requests'">
      <div class="segmented" role="tablist">
        <button
          v-for="s in STATUS_TABS"
          :key="s.value"
          type="button"
          role="tab"
          :aria-selected="status === s.value"
          :class="{ 'is-active': status === s.value }"
          @click="status = s.value"
        >
          {{ s.label }}
        </button>
      </div>

      <div v-if="loadingRequests" class="stack" style="--gap: 10px">
        <UiSkeleton v-for="i in 3" :key="i" height="110px" radius="20px" />
      </div>

      <UiCard v-else-if="!requests.length">
        <UiEmpty
          :icon="Inbox"
          :title="status === 'pending' ? 'No requests waiting' : 'Nothing here'"
          description="When members ask for a profession that isn't listed, their requests show up here."
        />
      </UiCard>

      <TransitionGroup v-else name="list" tag="div" class="requests">
        <UiCard v-for="r in requests" :key="r.id" class="request">
          <div class="request__main">
            <RouterLink v-if="r.requester" :to="`/u/${r.requester.id}`" class="request__who">
              <UiAvatar :name="r.requester.name" :src="r.requester.avatarUrl" :size="44" />
            </RouterLink>
            <div class="grow" style="min-width: 0">
              <p class="request__line">
                <RouterLink v-if="r.requester" :to="`/u/${r.requester.id}`" class="request__name">{{ r.requester.name }}</RouterLink>
                <span v-else class="request__name">Deleted member</span>
                <span class="muted"> asked for</span>
              </p>
              <h3 class="request__label">{{ r.label }}</h3>
              <div class="row wrap" style="--gap: 6px; margin-top: 6px">
                <span class="cat-pill" :style="{ '--hue': store.category(r.category).hue }">
                  <component :is="store.category(r.category).icon" /> {{ store.category(r.category).label }}
                </span>
                <UiBadge v-if="r.status === 'pending' && r.demand > 1" tone="warning" :icon="Flame">
                  Requested by {{ r.demand }} people
                </UiBadge>
                <UiBadge v-if="r.status === 'approved'" tone="success">Approved</UiBadge>
                <UiBadge v-if="r.status === 'rejected'" tone="danger">Declined</UiBadge>
                <span class="subtle small">{{ timeAgo(r.createdAt) }}</span>
              </div>
              <p v-if="r.note" class="request__note">“{{ r.note }}”</p>
              <p v-if="r.status !== 'pending' && r.reviewer" class="subtle small" style="margin-top: 6px">
                Reviewed by {{ r.reviewer.name }} {{ timeAgo(r.reviewedAt) }}
                <template v-if="r.reviewNote"> · “{{ r.reviewNote }}”</template>
              </p>
              <div v-if="r.status === 'approved' && r.professionKey" style="margin-top: 8px">
                <ProfessionBadge :profession="r.professionKey" size="sm" />
              </div>
            </div>
          </div>
          <div v-if="r.status === 'pending'" class="request__actions">
            <UiButton variant="secondary" :icon="X" @click="openReject(r)">Decline</UiButton>
            <UiButton :icon="Check" @click="openApprove(r)">Approve &amp; add</UiButton>
          </div>
        </UiCard>
      </TransitionGroup>
    </template>

    <!-- Catalog -->
    <template v-else>
      <div class="toolbar">
        <label class="search">
          <Search />
          <input v-model="catalogQuery" type="search" placeholder="Search professions" aria-label="Search professions" />
        </label>
        <UiSelect v-model="catalogCategory" :options="categoryOptions" aria-label="Category" class="toolbar__select" />
        <UiButton :icon="Plus" @click="openEdit(null)">Add profession</UiButton>
      </div>
      <UiToggle v-model="showInactive" label="Show hidden professions" class="inactive-toggle" />

      <div v-if="loadingCatalog" class="stack" style="--gap: 8px">
        <UiSkeleton v-for="i in 6" :key="i" height="58px" radius="14px" />
      </div>

      <UiCard v-else :padded="false">
        <p class="catalog-count muted">{{ filteredCatalog.length }} of {{ catalog.length }} professions</p>
        <ul class="catalog">
          <li v-for="p in filteredCatalog" :key="p.key" class="prow" :class="{ 'is-off': !p.active }" :style="{ '--hue': p.hue }">
            <span class="prow__icon"><component :is="iconFor(p.icon)" /></span>
            <div class="grow" style="min-width: 0">
              <strong class="truncate" style="display: block">{{ p.label }}</strong>
              <span class="subtle small">{{ store.category(p.category).label }} · {{ p.userCount }} {{ p.userCount === 1 ? 'member' : 'members' }}</span>
            </div>
            <UiBadge v-if="!p.active" tone="neutral">Hidden</UiBadge>
            <button
              type="button"
              class="switch"
              :class="{ 'is-on': p.active }"
              role="switch"
              :aria-checked="p.active"
              :aria-label="p.active ? `Hide ${p.label}` : `Show ${p.label}`"
              :disabled="p.key === 'other'"
              @click="toggleActive(p)"
            >
              <span />
            </button>
            <UiButton variant="ghost" size="sm" :icon="Pencil" icon-only :aria-label="`Edit ${p.label}`" @click="openEdit(p)" />
          </li>
        </ul>
        <UiEmpty
          v-if="!filteredCatalog.length"
          compact
          :icon="BriefcaseBusiness"
          title="No professions match"
          description="Add it to the list so members can pick it."
        >
          <UiButton size="sm" :icon="Plus" @click="openEdit(null)">Add “{{ catalogQuery.trim() || 'profession' }}”</UiButton>
        </UiEmpty>
      </UiCard>
    </template>

    <UiSheet v-model:open="approveOpen" title="Approve and add profession" width="520px">
      <div class="stack" style="--gap: 16px">
        <p class="muted">
          Fix the name or category if needed. Other pending requests with the same name are approved too.
        </p>
        <ProfessionForm v-model="approveForm" :errors="approveErrors" />
        <UiToggle
          v-model="assign"
          :label="`Set as ${approving?.requester?.name?.split(' ')[0] || 'the member'}'s profession`"
          description="Their profile switches to this profession straight away."
        />
      </div>
      <template #footer>
        <UiButton variant="secondary" class="grow" @click="approveOpen = false">Cancel</UiButton>
        <UiButton class="grow" :icon="Check" :loading="busy" :disabled="approveForm.label.trim().length < 2" @click="approve">
          Approve
        </UiButton>
      </template>
    </UiSheet>

    <UiSheet v-model:open="rejectOpen" title="Decline request" width="440px">
      <div class="stack" style="--gap: 12px">
        <p class="muted">
          Decline <strong>“{{ rejecting?.label }}”</strong>? The member is notified, along with your note if you add one.
        </p>
        <UiTextarea
          v-model="rejectNote"
          label="Note to the member (optional)"
          :maxlength="300"
          :rows="3"
          placeholder="e.g. Please pick “Creative Artist”, it covers this."
        />
      </div>
      <template #footer>
        <UiButton variant="secondary" class="grow" @click="rejectOpen = false">Cancel</UiButton>
        <UiButton variant="danger" class="grow" :icon="X" :loading="busy" @click="reject">Decline</UiButton>
      </template>
    </UiSheet>

    <UiSheet v-model:open="editOpen" :title="editing ? 'Edit profession' : 'Add profession'" width="520px">
      <ProfessionForm v-model="editForm" :errors="editErrors" />
      <template #footer>
        <UiButton variant="secondary" class="grow" @click="editOpen = false">Cancel</UiButton>
        <UiButton class="grow" :loading="busy" :disabled="editForm.label.trim().length < 2" @click="saveProfession">
          {{ editing ? 'Save' : 'Add profession' }}
        </UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.head-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 15px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
}
.head-icon svg {
  width: 24px;
  height: 24px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
}
.stat strong {
  display: block;
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1.1;
}
.stat > div {
  min-width: 0;
}
.stat span:last-child {
  display: block;
  font-size: 0.8rem;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stat__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 13px;
  background: var(--primary-soft);
  color: var(--primary);
}
.stat__icon svg {
  width: 20px;
  height: 20px;
}
.stat.is-hot {
  border-color: color-mix(in srgb, var(--warning) 45%, var(--border));
}
.stat.is-hot .stat__icon {
  background: var(--warning-soft);
  color: var(--warning);
}

.segmented {
  display: inline-flex;
  align-self: flex-start;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--surface-3);
}
.segmented button {
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.86rem;
}
.segmented button.is-active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.requests {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.request {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}
.request__main {
  display: flex;
  gap: 14px;
  flex: 1 1 360px;
  min-width: 0;
}
.request__line {
  font-size: 0.88rem;
}
.request__name {
  font-weight: 700;
}
a.request__name:hover {
  color: var(--primary);
}
.request__label {
  font-size: 1.2rem;
  font-weight: 800;
  margin-top: 2px;
}
.request__note {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 0.88rem;
  font-style: italic;
}
.request__actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border-radius: 99px;
  background: hsl(var(--hue) 85% 95%);
  color: hsl(var(--hue) 60% 38%);
  font-size: 0.74rem;
  font-weight: 700;
}
[data-theme='dark'] .cat-pill {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.cat-pill svg {
  width: 13px;
  height: 13px;
}
.small {
  font-size: 0.8rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.search {
  position: relative;
  flex: 1 1 240px;
  display: flex;
  align-items: center;
}
.search svg {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: var(--text-3);
}
.search input {
  width: 100%;
  height: 44px;
  padding: 0 14px 0 42px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 16px;
}
.search input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.toolbar__select {
  flex: 0 1 240px;
}
.inactive-toggle {
  max-width: 360px;
}
.catalog-count {
  padding: 12px 16px 0;
  font-size: 0.82rem;
}
.catalog {
  list-style: none;
  margin: 0;
  padding: 6px;
}
.prow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 12px;
}
.prow:hover {
  background: var(--surface-2);
}
.prow.is-off {
  opacity: 0.6;
}
.prow__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 11px;
  background: hsl(var(--hue) 85% 95%);
  color: hsl(var(--hue) 60% 40%);
}
[data-theme='dark'] .prow__icon {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.prow__icon svg {
  width: 18px;
  height: 18px;
}
.switch {
  position: relative;
  width: 42px;
  height: 24px;
  flex-shrink: 0;
  border: 0;
  border-radius: 99px;
  background: var(--border-strong);
  transition: background-color 0.2s var(--ease);
}
.switch span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s var(--ease);
}
.switch.is-on {
  background: var(--success);
}
.switch.is-on span {
  transform: translateX(18px);
}
.switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 559px) {
  .request__actions {
    width: 100%;
  }
  .request__actions > * {
    flex: 1;
  }
}
</style>
