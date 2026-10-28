<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
  UserCheck,
  Flag,
  History,
  LayoutDashboard,
  ChevronRight,
  PartyPopper,
  Settings,
} from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from 'vue-i18n';
import { useProfessionsStore } from '@/stores/professions';
import { toast } from '@/composables/useToast';
import { iconFor } from '@/constants/professions';
import { timeAgo } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiToggle from '@/components/ui/UiToggle.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiSearchSelect from '@/components/ui/UiSearchSelect.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import ProfessionBadge from '@/components/ProfessionBadge.vue';
import ProfessionForm from '@/components/admin/ProfessionForm.vue';
import AdminUsers from '@/components/admin/AdminUsers.vue';
import AdminPlans from '@/components/admin/AdminPlans.vue';
import AdminPlanRequests from '@/components/admin/AdminPlanRequests.vue';
import AdminListings from '@/components/admin/AdminListings.vue';
import AdminReports from '@/components/admin/AdminReports.vue';
import AdminActivity from '@/components/admin/AdminActivity.vue';

const store = useProfessionsStore();
const auth = useAuthStore();
const { t } = useI18n();

const route = useRoute();
const router = useRouter();
const TAB_KEYS = ['overview', 'approvals', 'users', 'reports', 'listings', 'plans', 'plan-requests', 'requests', 'catalog', 'activity'];
const DEFAULT_TAB = 'overview';
// Notifications link straight to a section, e.g. /admin?tab=plan-requests.
const tab = ref(TAB_KEYS.includes(route.query.tab) ? route.query.tab : DEFAULT_TAB);
watch(
  () => route.query.tab,
  (t) => (tab.value = TAB_KEYS.includes(t) ? t : DEFAULT_TAB),
);
// Keep the tab in the URL so the header navigation highlights the right section and links can be shared.
watch(tab, (t) => {
  if (route.query.tab !== t) router.replace({ query: { ...route.query, tab: t } });
});
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

/** Sidebar sections. `alert` counts are things waiting for an admin; `count` is just a total. */
const SECTION_ICONS = {
  overview: LayoutDashboard,
  approvals: UserCheck,
  users: Users,
  reports: Flag,
  listings: Store,
  plans: Crown,
  'plan-requests': Send,
  requests: Inbox,
  catalog: BriefcaseBusiness,
  activity: History,
};
const i18nKey = (key) => (key === 'plan-requests' ? 'planRequests' : key);
const SECTIONS = computed(() =>
  Object.fromEntries(
    Object.entries(SECTION_ICONS).map(([key, icon]) => [
      key,
      { icon, label: t(`admin.sections.${i18nKey(key)}`), text: t(`admin.sections.${i18nKey(key)}Text`) },
    ]),
  ),
);
const navGroups = computed(() => [
  { title: '', items: [{ key: 'overview' }] },
  {
    title: t('admin.groups.members'),
    items: [
      { key: 'approvals', alert: stats.value?.pendingApprovals },
      { key: 'users', count: stats.value?.users },
      { key: 'reports', alert: stats.value?.openReports },
    ],
  },
  { title: t('admin.groups.marketplace'), items: [{ key: 'listings', count: stats.value?.activeListings }] },
  {
    title: t('admin.groups.plans'),
    items: [
      { key: 'plans', count: plans.value.length },
      { key: 'plan-requests', alert: stats.value?.pendingPlanRequests },
    ],
  },
  {
    title: t('admin.groups.professions'),
    items: [
      { key: 'requests', alert: stats.value?.pendingRequests },
      { key: 'catalog', count: stats.value?.professions },
    ],
  },
  { title: t('admin.groups.system'), items: [{ key: 'activity' }] },
]);
const section = computed(() => SECTIONS.value[tab.value]);
// New sign-ups, reports and requests arrive as notifications; keep the sidebar counts current.
watch(
  () => auth.user?.unreadNotifications,
  (n, prev) => n > (prev || 0) && loadStats(),
);

// ---------- Overview ----------
const o = (key) => t(`admin.overview.${key}`);
const kpis = computed(() => [
  { label: o('members'), value: stats.value?.users, icon: Users, hue: 243, to: 'users' },
  { label: o('activeListings'), value: stats.value?.activeListings, icon: Store, hue: 190, to: 'listings' },
  { label: o('paidPlan'), value: stats.value?.subscribers, icon: Crown, hue: 38, to: 'plans' },
  { label: o('openToWork'), value: stats.value?.availableWorkers, icon: HardHat, hue: 152, to: 'users' },
]);
const attention = computed(() =>
  [
    { key: 'approvals', label: o('approvals'), value: stats.value?.pendingApprovals, icon: UserCheck },
    { key: 'reports', label: o('reports'), value: stats.value?.openReports, icon: Flag },
    { key: 'plan-requests', label: o('planRequests'), value: stats.value?.pendingPlanRequests, icon: Send },
    { key: 'requests', label: o('professionRequests'), value: stats.value?.pendingRequests, icon: Hourglass },
  ].filter((a) => a.value > 0),
);
const smallStats = computed(() => [
  { label: o('suspended'), value: stats.value?.suspended, icon: Ban, to: 'users' },
  { label: o('admins'), value: stats.value?.admins, icon: ShieldHalf, to: 'users' },
  { label: o('activePlans'), value: stats.value?.plans, icon: Crown, to: 'plans' },
  { label: o('professions'), value: stats.value?.professions, icon: BriefcaseBusiness, to: 'catalog' },
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
const catalogFilter = ref({ categories: [] });
/** The single picked category (if exactly one), used as the default when adding a profession. */
const catalogCategory = computed(() => (catalogFilter.value.categories.length === 1 ? catalogFilter.value.categories[0] : ''));
const showInactive = ref(false);
const categoryGroups = computed(() => {
  const perCategory = new Map();
  for (const p of catalog.value) perCategory.set(p.category, (perCategory.get(p.category) || 0) + 1);
  return [
    {
      key: 'categories',
      title: t('common.categories'),
      options: store.categories.map((c) => ({ ...c, meta: perCategory.get(c.key) || 0 })),
    },
  ];
});

const filteredCatalog = computed(() => {
  const q = catalogQuery.value.trim().toLowerCase();
  const picked = new Set(catalogFilter.value.categories);
  return catalog.value.filter(
    (p) =>
      (showInactive.value || p.active) &&
      (!picked.size || picked.has(p.category)) &&
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
  <div class="container console">
    <!-- Sidebar -->
    <aside class="side" :aria-label="t('admin.console')">
      <div class="side__head">
        <span class="side__logo"><ShieldHalf /></span>
        <div class="grow" style="min-width: 0">
          <strong>{{ t('admin.console') }}</strong>
          <span class="truncate">{{ auth.user?.name }}</span>
        </div>
      </div>

      <nav class="side__nav">
        <div v-for="g in navGroups" :key="g.title || 'main'" class="side__group">
          <p v-if="g.title" class="side__title">{{ g.title }}</p>
          <button
            v-for="item in g.items"
            :key="item.key"
            type="button"
            class="side__link"
            :class="{ 'is-active': tab === item.key }"
            :aria-current="tab === item.key ? 'page' : undefined"
            @click="tab = item.key"
          >
            <component :is="SECTIONS[item.key].icon" class="side__icon" />
            <span class="side__label">{{ SECTIONS[item.key].label }}</span>
            <span v-if="item.alert" class="side__alert">{{ item.alert > 99 ? '99+' : item.alert }}</span>
            <span v-else-if="item.count" class="side__count">{{ item.count }}</span>
          </button>
        </div>
      </nav>

      <RouterLink to="/settings" class="side__foot">
        <Settings /> {{ t('admin.accountSettings') }}
      </RouterLink>
    </aside>

    <!-- Content -->
    <section class="main">
      <header class="main__head">
        <span class="main__icon"><component :is="section.icon" /></span>
        <div class="grow" style="min-width: 0">
          <p class="main__crumb">{{ t('admin.console') }} <ChevronRight /> {{ section.label }}</p>
          <h1 class="main__title">{{ section.label }}</h1>
          <p class="muted">{{ section.text }}</p>
        </div>
      </header>

    <Transition name="section" mode="out-in">
    <div :key="tab" class="main__body">
    <!-- Overview -->
    <template v-if="tab === 'overview'">
      <div class="kpis">
        <button v-for="k in kpis" :key="k.label" type="button" class="kpi" :style="{ '--hue': k.hue }" @click="tab = k.to">
          <span class="kpi__icon"><component :is="k.icon" /></span>
          <span class="kpi__body">
            <strong v-if="stats">{{ k.value ?? 0 }}</strong>
            <UiSkeleton v-else width="48px" height="28px" />
            <span>{{ k.label }}</span>
          </span>
        </button>
      </div>

      <div class="overview">
        <UiCard class="attention">
          <h2 class="card-title">{{ o('attention') }}</h2>
          <ul v-if="attention.length" class="attention__list">
            <li v-for="a in attention" :key="a.key">
              <button type="button" class="attention__item" @click="tab = a.key">
                <span class="attention__icon"><component :is="a.icon" /></span>
                <span class="grow">{{ a.label }}</span>
                <strong>{{ a.value }}</strong>
                <ChevronRight class="attention__go" />
              </button>
            </li>
          </ul>
          <div v-else-if="stats" class="attention__clear">
            <PartyPopper />
            <div>
              <strong>{{ o('caughtUp') }}</strong>
              <p class="muted">{{ o('caughtUpText') }}</p>
            </div>
          </div>
          <UiSkeleton v-else height="120px" />

          <div class="mini-stats">
            <button v-for="s in smallStats" :key="s.label" type="button" class="mini-stat" @click="tab = s.to">
              <component :is="s.icon" />
              <span>{{ s.label }}</span>
              <strong>{{ stats ? s.value ?? 0 : '–' }}</strong>
            </button>
          </div>
        </UiCard>

        <UiCard class="recent">
          <div class="row-between">
            <h2 class="card-title">{{ o('recent') }}</h2>
            <UiButton size="sm" variant="ghost" :icon-right="ChevronRight" @click="tab = 'activity'">{{ o('fullLog') }}</UiButton>
          </div>
          <AdminActivity compact />
        </UiCard>
      </div>
    </template>

    <AdminUsers v-else-if="tab === 'approvals'" key="approvals" :plans="plans" initial-status="pending" @changed="onAccountsChanged" />
    <AdminUsers v-else-if="tab === 'users'" key="users" :plans="plans" @changed="onAccountsChanged" />
    <AdminReports v-else-if="tab === 'reports'" :plans="plans" @changed="onAccountsChanged" />
    <AdminListings v-else-if="tab === 'listings'" @changed="onAccountsChanged" />
    <AdminPlans v-else-if="tab === 'plans'" :plans="plans" :loading="loadingPlans" @changed="onAccountsChanged" />
    <AdminPlanRequests v-else-if="tab === 'plan-requests'" @changed="onAccountsChanged" />
    <AdminActivity v-else-if="tab === 'activity'" />

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
    <template v-else-if="tab === 'catalog'">
      <div class="toolbar">
        <label class="search">
          <Search />
          <input v-model="catalogQuery" type="search" placeholder="Search professions" aria-label="Search professions" />
        </label>
        <UiSearchSelect
          v-model="catalogFilter"
          :groups="categoryGroups"
          :all-label="t('common.allCategories')"
          :placeholder="t('market.catPlaceholder')"
          class="toolbar__select"
        />
        <UiButton :icon="Plus" @click="openEdit(null)">Add profession</UiButton>
      </div>

      <div class="catalog-bar">
        <p class="muted">
          <strong>{{ filteredCatalog.length }}</strong> of {{ catalog.length }} professions
        </p>
        <UiToggle v-model="showInactive" label="Show hidden professions" class="inactive-toggle" />
      </div>

      <div v-if="loadingCatalog" class="pgrid">
        <UiSkeleton v-for="i in 9" :key="i" height="132px" radius="16px" />
      </div>

      <UiCard v-else-if="!filteredCatalog.length">
        <UiEmpty :icon="BriefcaseBusiness" title="No professions match" description="Add it to the list so members can pick it.">
          <UiButton size="sm" :icon="Plus" @click="openEdit(null)">Add “{{ catalogQuery.trim() || 'profession' }}”</UiButton>
        </UiEmpty>
      </UiCard>

      <TransitionGroup v-else name="list" tag="ul" class="pgrid">
        <li v-for="p in filteredCatalog" :key="p.key" class="pcard" :class="{ 'is-off': !p.active }" :style="{ '--hue': p.hue }">
          <div class="pcard__top">
            <span class="pcard__icon"><component :is="iconFor(p.icon)" /></span>
            <div class="pcard__actions">
              <button
                type="button"
                class="switch"
                :class="{ 'is-on': p.active }"
                role="switch"
                :aria-checked="p.active"
                :aria-label="p.active ? `Hide ${p.label}` : `Show ${p.label}`"
                :title="p.active ? 'Visible to members' : 'Hidden from members'"
                :disabled="p.key === 'other'"
                @click="toggleActive(p)"
              >
                <span />
              </button>
              <UiButton variant="ghost" size="sm" :icon="Pencil" icon-only :aria-label="`Edit ${p.label}`" @click="openEdit(p)" />
            </div>
          </div>
          <strong class="pcard__name">{{ p.label }}</strong>
          <span class="cat-pill" :style="{ '--hue': store.category(p.category).hue }">
            <component :is="store.category(p.category).icon" /> {{ store.category(p.category).label }}
          </span>
          <div class="pcard__foot">
            <span class="subtle small"><Users /> {{ p.userCount }} {{ p.userCount === 1 ? 'member' : 'members' }}</span>
            <UiBadge v-if="!p.active" tone="neutral">Hidden</UiBadge>
          </div>
        </li>
      </TransitionGroup>
    </template>
    </div>
    </Transition>
    </section>

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
/* ---------- Console layout ---------- */
.console {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.main {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

/* Sidebar: a horizontal strip on small screens, a sticky column on desktop. */
.side {
  position: sticky;
  top: var(--nav-h);
  z-index: 20;
  margin: -20px calc(-1 * var(--page-pad, 16px)) 0;
  padding: 8px var(--page-pad, 16px);
  background: color-mix(in srgb, var(--bg, var(--surface-2)) 92%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}
.side__head,
.side__title,
.side__foot {
  display: none;
}
.side__nav {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.side__nav::-webkit-scrollbar {
  display: none;
}
.side__group {
  display: contents;
}
.side__link {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  height: 38px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.88rem;
  white-space: nowrap;
  transition: background-color 0.15s var(--ease), color 0.15s var(--ease);
}
.side__link:hover {
  background: var(--surface-3);
  color: var(--text);
}
.side__link.is-active {
  background: var(--primary-soft);
  color: var(--primary);
}
.side__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.side__alert,
.side__count {
  min-width: 22px;
  height: 20px;
  padding: 0 7px;
  border-radius: 99px;
  display: inline-grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 700;
}
.side__alert {
  background: var(--danger);
  color: #fff;
}
.side__count {
  background: var(--surface-3);
  color: var(--text-3);
}
.side__link.is-active .side__count {
  background: var(--surface);
  color: var(--primary);
}

@media (min-width: 1024px) {
  .console {
    grid-template-columns: 264px minmax(0, 1fr);
    gap: 24px;
  }
  .side {
    top: calc(var(--nav-h) + 20px);
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - var(--nav-h) - 40px);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    backdrop-filter: none;
    overflow: hidden;
  }
  .side__head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }
  .side__head strong {
    display: block;
    font-size: 0.98rem;
  }
  .side__head span {
    display: block;
    font-size: 0.8rem;
    color: var(--text-3);
  }
  .side__logo {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: #fff;
    box-shadow: 0 8px 18px -8px color-mix(in srgb, var(--primary) 70%, transparent);
  }
  .side__logo svg {
    width: 20px;
    height: 20px;
  }
  .side__nav {
    flex: 1;
    flex-direction: column;
    gap: 2px;
    padding: 10px;
    overflow-x: hidden;
    overflow-y: auto;
  }
  .side__group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .side__group + .side__group {
    margin-top: 10px;
  }
  .side__title {
    display: block;
    padding: 6px 12px 4px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .side__link {
    width: 100%;
    height: 40px;
  }
  .side__link.is-active::before {
    content: '';
    position: absolute;
    left: -10px;
    top: 8px;
    bottom: 8px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--primary);
  }
  .side__label {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .side__foot {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-top: 1px solid var(--border);
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--text-2);
  }
  .side__foot:hover {
    color: var(--primary);
  }
  .side__foot svg {
    width: 17px;
    height: 17px;
  }
}

.main__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.section-enter-active,
.section-leave-active {
  transition: opacity 0.16s var(--ease), transform 0.16s var(--ease);
}
.section-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.section-leave-to {
  opacity: 0;
}

/* ---------- Section header ---------- */
.main__head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.main__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 15px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
  box-shadow: 0 12px 24px -12px color-mix(in srgb, var(--primary) 80%, transparent);
}
.main__icon svg {
  width: 23px;
  height: 23px;
}
.main__crumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-3);
}
.main__crumb svg {
  width: 13px;
  height: 13px;
}
.main__title {
  font-size: clamp(1.35rem, 2.4vw, 1.7rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.main__head p.muted {
  margin-top: 2px;
  font-size: 0.9rem;
}

/* ---------- Overview ---------- */
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
}
.kpi {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  text-align: left;
  overflow: hidden;
  transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease), border-color 0.2s var(--ease);
}
.kpi::after {
  content: '';
  position: absolute;
  right: -30px;
  top: -30px;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: radial-gradient(circle, hsl(var(--hue) 85% 60% / 0.16), transparent 70%);
}
.kpi:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
  border-color: hsl(var(--hue) 60% 60% / 0.5);
}
.kpi__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, hsl(var(--hue) 80% 60%), hsl(calc(var(--hue) + 30) 75% 50%));
  color: #fff;
}
.kpi__icon svg {
  width: 22px;
  height: 22px;
}
.kpi__body strong {
  display: block;
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.kpi__body span {
  display: block;
  font-size: 0.82rem;
  color: var(--text-3);
}
.overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
@media (min-width: 1180px) {
  .overview {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }
}
.card-title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 12px;
}
.attention__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.attention__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--warning) 35%, var(--border));
  background: var(--warning-soft);
  text-align: left;
  font-weight: 600;
  font-size: 0.9rem;
  transition: transform 0.15s var(--ease);
}
.attention__item:hover {
  transform: translateX(3px);
}
.attention__item strong {
  font-size: 1.1rem;
}
.attention__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--surface);
  color: var(--warning);
}
.attention__icon svg,
.attention__go {
  width: 17px;
  height: 17px;
}
.attention__go {
  color: var(--text-3);
}
.attention__clear {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: var(--radius);
  background: var(--success-soft, var(--surface-2));
}
.attention__clear > svg {
  width: 28px;
  height: 28px;
  color: var(--success);
  flex-shrink: 0;
}
.attention__clear p {
  font-size: 0.86rem;
}
.mini-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}
.mini-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 0.82rem;
  color: var(--text-2);
  text-align: left;
}
.mini-stat:hover {
  border-color: var(--border-strong);
}
.mini-stat svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: var(--text-3);
}
.mini-stat span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-stat strong {
  color: var(--text);
}
.recent .row-between {
  margin-bottom: 4px;
}
.recent .card-title {
  margin-bottom: 0;
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
.catalog-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.86rem;
}
.catalog-bar strong {
  color: var(--text);
}
.pgrid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}
.pcard {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
  transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease), border-color 0.2s var(--ease), opacity 0.2s;
}
.pcard::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 4px;
  background: linear-gradient(90deg, hsl(var(--hue) 75% 58%), hsl(calc(var(--hue) + 35) 70% 55%));
}
.pcard:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
  border-color: hsl(var(--hue) 60% 65% / 0.5);
}
.pcard.is-off {
  opacity: 0.6;
}
.pcard.is-off::before {
  background: var(--border-strong);
}
.pcard__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.pcard__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.pcard__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 13px;
  background: hsl(var(--hue) 85% 95%);
  color: hsl(var(--hue) 60% 40%);
}
[data-theme='dark'] .pcard__icon {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.pcard__icon svg {
  width: 21px;
  height: 21px;
}
.pcard__name {
  font-size: 0.98rem;
  line-height: 1.3;
}
.pcard__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}
.pcard__foot .small {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.pcard__foot svg {
  width: 13px;
  height: 13px;
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
