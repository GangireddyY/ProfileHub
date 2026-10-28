<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import {
  Search,
  SlidersHorizontal,
  LocateFixed,
  SearchX,
  MapPin,
  Users,
  Inbox,
  X,
  BadgeIndianRupee,
  Sparkles,
  ArrowRight,
} from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useProfessionsStore } from '@/stores/professions';
import { useGeolocation } from '@/composables/useGeolocation';
import { toast } from '@/composables/useToast';
import { getProfession } from '@/constants/professions';
import { formatRate, formatMoney } from '@/utils/format';
import { DISTANCE_STEPS, DEFAULT_FILTERS, stepForRadius } from '@/constants/filters';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiSpinner from '@/components/ui/UiSpinner.vue';
import ProfileCard from '@/components/ProfileCard.vue';
import FilterPanel from '@/components/FilterPanel.vue';
import UiSearchSelect from '@/components/ui/UiSearchSelect.vue';
import ProfessionBadge from '@/components/ProfessionBadge.vue';
import { useI18n } from 'vue-i18n';

const STORAGE_KEY = 'ph_filters';
const { t } = useI18n();
const auth = useAuthStore();
const professions = useProfessionsStore();
const geo = useGeolocation();
const route = useRoute();
const me = computed(() => auth.user);

function savedFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) return { ...DEFAULT_FILTERS, ...saved };
  } catch {
    /* ignore corrupt storage */
  }
  return {
    ...DEFAULT_FILTERS,
    distanceIdx: me.value?.hasLocation ? stepForRadius(me.value.discoveryRadiusKm) : DEFAULT_FILTERS.distanceIdx,
  };
}

/** Links from search (`?profession=driver` or `?q=…`) start from a clean slate for that query. */
function initialFilters() {
  const base = savedFilters();
  const { profession, q } = route.query;
  if (typeof profession === 'string' && profession) return { ...base, q: '', professions: [profession], categories: [] };
  if (typeof q === 'string' && q) return { ...base, q, professions: [], categories: [] };
  return base;
}

const filters = ref(initialFilters());
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pages = ref(1);
const meta = ref({ hasLocation: false, distanceApplied: false });
const loading = ref(true);
const loadingMore = ref(false);
const error = ref('');
const filtersOpen = ref(false);
const sentinel = ref(null);

const maxDistance = computed(() => DISTANCE_STEPS[filters.value.distanceIdx]);
const activeFilterCount = computed(
  () =>
    (maxDistance.value != null && me.value?.hasLocation ? 1 : 0) +
    (filters.value.onlineOnly ? 1 : 0) +
    (filters.value.availableOnly ? 1 : 0) +
    (filters.value.maxRate != null ? 1 : 0) +
    (filters.value.sort !== 'recommended' ? 1 : 0),
);
const pickedProfessions = computed(() => filters.value.professions.map((key) => getProfession(key)));
const pickedCategories = computed(() => filters.value.categories.map((key) => professions.category(key)));

const categoryFilter = computed({
  get: () => ({ categories: filters.value.categories, professions: filters.value.professions }),
  set: ({ categories, professions: picked }) => {
    filters.value.categories = categories;
    filters.value.professions = picked;
  },
});
const categoryGroups = computed(() => {
  const active = professions.list.filter((p) => p.active !== false);
  const perCategory = new Map();
  for (const p of active) perCategory.set(p.category, (perCategory.get(p.category) || 0) + 1);
  return [
    {
      key: 'categories',
      title: t('common.categories'),
      options: professions.categories.map((c) => ({ ...c, meta: perCategory.get(c.key) || 0 })),
    },
    {
      key: 'professions',
      title: t('common.professions'),
      searchOnly: true,
      limit: 40,
      options: active.map((p) => ({ ...p, meta: professions.category(p.category).label })),
    },
  ];
});
const myRate = computed(() => formatRate(me.value));
const profileIncomplete = computed(() => me.value?.profession === 'other' && !me.value?.roleTitle);
const greeting = computed(() => {
  const h = new Date().getHours();
  return t(h < 12 ? 'discover.greeting.morning' : h < 18 ? 'discover.greeting.afternoon' : 'discover.greeting.evening');
});
const myHue = computed(() => getProfession(me.value?.profession).hue);

let requestId = 0;
async function load({ append = false } = {}) {
  const id = ++requestId;
  if (append) loadingMore.value = true;
  else loading.value = true;
  error.value = '';

  const f = filters.value;
  try {
    const { data } = await api.get('/users/discover', {
      params: {
        q: f.q || undefined,
        professions: f.professions.join(',') || undefined,
        categories: f.categories.join(',') || undefined,
        maxDistance: maxDistance.value ?? undefined,
        onlineOnly: f.onlineOnly || undefined,
        availableOnly: f.availableOnly || undefined,
        maxRate: f.maxRate ?? undefined,
        sort: f.sort,
        page: append ? page.value + 1 : 1,
        limit: 12,
      },
    });
    if (id !== requestId) return;
    items.value = append ? [...items.value, ...data.items] : data.items;
    total.value = data.total;
    page.value = data.page;
    pages.value = data.pages;
    meta.value = data.meta;
  } catch (err) {
    if (id === requestId) error.value = errorMessage(err);
  } finally {
    if (id === requestId) {
      loading.value = false;
      loadingMore.value = false;
      nextTick(maybeLoadMore);
    }
  }
}

const PRELOAD_PX = 400;

/** The observer only fires on changes, so on tall screens the sentinel can stay in view after a page loads. */
function maybeLoadMore() {
  if (error.value || loading.value || loadingMore.value || page.value >= pages.value || !sentinel.value) return;
  if (sentinel.value.getBoundingClientRect().top < window.innerHeight + PRELOAD_PX) load({ append: true });
}

let debounce;
watch(
  filters,
  (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, q: '' }));
    clearTimeout(debounce);
    debounce = setTimeout(() => load(), 280);
  },
  { deep: true },
);

watch(
  () => me.value?.hasLocation,
  (has, had) => {
    if (has !== had) load();
  },
);

function removeCategory(key) {
  filters.value.categories = filters.value.categories.filter((c) => c !== key);
}

function removeProfession(key) {
  filters.value.professions = filters.value.professions.filter((p) => p !== key);
}

function resetFilters() {
  filters.value = { ...DEFAULT_FILTERS, q: filters.value.q };
}

async function enableLocation() {
  if (await geo.locate()) {
    toast.success(me.value.city ? t('discover.locationNear', { city: me.value.city }) : t('discover.locationOn'));
    if (maxDistance.value == null) filters.value.distanceIdx = stepForRadius(me.value.discoveryRadiusKm);
  } else {
    toast.error(geo.error.value);
  }
}

function onCardChange(user, { status }) {
  const wasConnected = user.connectionStatus === 'connected';
  user.connectionStatus = status;
  if (status === 'connected' && !wasConnected) user.connectionCount++;
  if (status !== 'incoming') user.connectionId = status === 'none' ? null : user.connectionId;
  auth.fetchMe().catch(() => {});
}

let observer;
onMounted(() => {
  load();
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) maybeLoadMore();
    },
    { rootMargin: `${PRELOAD_PX}px` },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clearTimeout(debounce);
});
</script>

<template>
  <div class="container page-layout discover">
    <aside class="page-aside page-aside--sticky discover__side">
      <UiCard :padded="false" class="mini" :style="{ '--hue': myHue }">
        <div class="mini__cover" />
        <RouterLink :to="`/u/${me.id}`" class="mini__body">
          <UiAvatar :name="me.name" :src="me.avatarUrl" :size="56" ring class="mini__avatar" />
          <strong class="mini__name">{{ me.name }}</strong>
          <span class="muted mini__role">{{ me.roleTitle || t('discover.addRole') }}</span>
          <ProfessionBadge :profession="me.profession" size="sm" />
        </RouterLink>
        <div class="mini__stats">
          <RouterLink to="/network" class="mini__stat">
            <span><Users /> {{ t('discover.connections') }}</span><strong>{{ me.connectionCount }}</strong>
          </RouterLink>
          <RouterLink to="/network" class="mini__stat">
            <span><Inbox /> {{ t('discover.invitations') }}</span><strong :class="{ hot: me.pendingRequests }">{{ me.pendingRequests }}</strong>
          </RouterLink>
          <RouterLink to="/settings#location" class="mini__stat">
            <span><MapPin /> {{ t('discover.location') }}</span>
            <strong :class="me.hasLocation ? 'ok' : 'off'">{{ me.hasLocation ? me.city || t('common.on') : t('common.off') }}</strong>
          </RouterLink>
          <RouterLink to="/settings#profile" class="mini__stat">
            <span><BadgeIndianRupee /> {{ t('discover.myRate') }}</span>
            <strong :class="myRate ? 'ok' : 'off'">{{ myRate || t('common.notSet') }}</strong>
          </RouterLink>
        </div>
      </UiCard>

      <UiCard class="side-filters">
        <FilterPanel
          v-model="filters"
          :has-location="me.hasLocation"
          :locating="geo.loading.value"
          :location-error="geo.error.value"
          @enable-location="enableLocation"
          @reset="resetFilters"
        />
      </UiCard>
    </aside>

    <section class="discover__main">
      <header class="hero">
        <p class="muted hero__greet">{{ greeting }}, {{ me.name.split(' ')[0] }} 👋</p>
        <h1 class="page-title">{{ t('discover.title') }}</h1>
      </header>

      <div class="page-toolbar">
        <label class="searchbar__field">
          <Search class="searchbar__icon" />
          <input
            v-model.trim="filters.q"
            type="search"
            :placeholder="t('discover.searchPlaceholder')"
            :aria-label="t('discover.searchLabel')"
            enterkeyhint="search"
          />
          <button v-if="filters.q" type="button" class="searchbar__clear" :aria-label="t('common.clearSearch')" @click="filters.q = ''">
            <X />
          </button>
        </label>
        <UiSearchSelect
          v-model="categoryFilter"
          :groups="categoryGroups"
          :all-label="t('common.allCategories')"
          :placeholder="t('discover.catPlaceholder')"
        />
        <button type="button" class="filter-btn" :aria-label="t('common.filters')" @click="filtersOpen = true">
          <SlidersHorizontal />
          <span class="filter-btn__text">{{ t('common.filters') }}</span>
          <span v-if="activeFilterCount" class="filter-btn__count">{{ activeFilterCount }}</span>
        </button>
      </div>

      <div
        v-if="pickedCategories.length || pickedProfessions.length || filters.maxRate != null || filters.availableOnly"
        class="active-filters"
      >
        <button
          v-for="c in pickedCategories"
          :key="c.key"
          type="button"
          class="active-filter"
          :style="{ '--hue': c.hue }"
          :aria-label="t('discover.removeFilter', { label: c.label })"
          @click="removeCategory(c.key)"
        >
          <component :is="c.icon" /> {{ c.label }} <X class="active-filter__x" />
        </button>
        <button
          v-for="p in pickedProfessions"
          :key="p.key"
          type="button"
          class="active-filter"
          :style="{ '--hue': p.hue }"
          :aria-label="t('discover.removeFilter', { label: p.label })"
          @click="removeProfession(p.key)"
        >
          <component :is="p.icon" /> {{ p.label }} <X class="active-filter__x" />
        </button>
        <button v-if="filters.availableOnly" type="button" class="active-filter" @click="filters.availableOnly = false">
          {{ t('discover.available') }} <X class="active-filter__x" />
        </button>
        <button v-if="filters.maxRate != null" type="button" class="active-filter" @click="filters.maxRate = null">
          {{ t('common.upTo', { amount: formatMoney(filters.maxRate) }) }} <X class="active-filter__x" />
        </button>
      </div>

      <RouterLink v-if="profileIncomplete" to="/welcome" class="setup-banner">
        <span class="setup-banner__icon"><Sparkles /></span>
        <div class="grow">
          <strong>{{ t('discover.finishTitle') }}</strong>
          <p>{{ t('discover.finishText') }}</p>
        </div>
        <span class="setup-banner__go">{{ t('discover.continue') }} <ArrowRight /></span>
      </RouterLink>

      <Transition name="fade">
        <div v-if="!me.hasLocation" class="locate-banner">
          <span class="locate-banner__icon"><LocateFixed /></span>
          <div class="grow">
            <strong>{{ t('discover.nearTitle') }}</strong>
            <p class="muted">{{ t('discover.nearText') }}</p>
          </div>
          <UiButton size="sm" :loading="geo.loading.value" @click="enableLocation">{{ t('common.enable') }}</UiButton>
        </div>
      </Transition>

      <div class="results-head">
        <p v-if="!loading" class="muted">
          <strong class="results-count">{{ t('discover.people', total) }}</strong>
          <template v-if="meta.distanceApplied"> {{ t('discover.within', { km: maxDistance }) }}</template>
          <template v-if="filters.onlineOnly"> · {{ t('discover.onlineNow') }}</template>
        </p>
        <UiSkeleton v-else width="160px" height="18px" />
      </div>

      <div v-if="error" class="error-box">
        <p>{{ error }}</p>
        <UiButton size="sm" variant="secondary" @click="load()">{{ t('common.tryAgain') }}</UiButton>
      </div>

      <div v-else-if="loading" class="grid">
        <div v-for="i in 6" :key="i" class="skeleton-card">
          <UiSkeleton height="72px" radius="0" />
          <div class="stack" style="--gap: 10px; align-items: center; padding: 0 16px 18px; margin-top: -36px">
            <UiSkeleton width="76px" height="76px" radius="50%" />
            <UiSkeleton width="60%" height="16px" />
            <UiSkeleton width="80%" height="12px" />
            <UiSkeleton width="100%" height="34px" radius="10px" />
          </div>
        </div>
      </div>

      <UiCard v-else-if="!items.length">
        <UiEmpty
          :icon="SearchX"
          :title="t('discover.emptyTitle')"
          :description="t('discover.emptyText')"
        >
          <UiButton variant="secondary" @click="resetFilters(); filters.q = ''">{{ t('discover.clearAll') }}</UiButton>
        </UiEmpty>
      </UiCard>

      <TransitionGroup v-else name="list" tag="div" class="grid">
        <ProfileCard v-for="u in items" :key="u.id" :user="u" @change="onCardChange(u, $event)" />
      </TransitionGroup>

      <div ref="sentinel" class="sentinel">
        <UiSpinner v-if="loadingMore" :size="24" />
        <p v-else-if="!loading && items.length && page >= pages" class="subtle">{{ t('discover.seenAll') }}</p>
      </div>
    </section>

    <UiSheet v-model:open="filtersOpen" :title="t('common.filters')" width="440px">
      <FilterPanel
        v-model="filters"
        :has-location="me.hasLocation"
        :locating="geo.loading.value"
        :location-error="geo.error.value"
        @enable-location="enableLocation"
        @reset="resetFilters"
      />
      <template #footer>
        <UiButton block @click="filtersOpen = false">{{ t('common.showResults', { n: total }) }}</UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.discover__side {
  display: none;
}
.discover__main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.hero__greet {
  font-weight: 600;
  font-size: 0.92rem;
}

.searchbar__field {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}
.searchbar__icon {
  position: absolute;
  left: 16px;
  width: 20px;
  height: 20px;
  color: var(--text-3);
  pointer-events: none;
}
.searchbar__field input {
  width: 100%;
  height: 50px;
  padding: 0 44px 0 48px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 16px;
  box-shadow: var(--shadow-xs);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.searchbar__field input::-webkit-search-cancel-button {
  display: none;
}
.searchbar__field input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.searchbar__clear {
  position: absolute;
  right: 8px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-3);
}
.searchbar__clear:hover {
  background: var(--surface-3);
}
.searchbar__clear svg {
  width: 18px;
  height: 18px;
}
.filter-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 50px;
  padding: 0 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  font-weight: 600;
  box-shadow: var(--shadow-xs);
}
.filter-btn:hover {
  border-color: var(--border-strong);
}
.filter-btn svg {
  width: 20px;
  height: 20px;
}
.filter-btn__count {
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  border-radius: 99px;
  background: var(--primary);
  color: #fff;
  font-size: 0.72rem;
}

.setup-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  color: #fff;
  background: linear-gradient(120deg, var(--primary), color-mix(in srgb, var(--primary) 50%, var(--accent)));
  box-shadow: 0 14px 30px -18px color-mix(in srgb, var(--primary) 80%, transparent);
  transition: transform 0.2s var(--ease);
}
.setup-banner:hover {
  transform: translateY(-2px);
}
.setup-banner p {
  font-size: 0.86rem;
  opacity: 0.85;
}
.setup-banner__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.18);
}
.setup-banner__icon svg {
  width: 22px;
  height: 22px;
}
.setup-banner__go {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 99px;
  background: #fff;
  color: var(--primary);
  font-weight: 700;
  font-size: 0.86rem;
}
.setup-banner__go svg {
  width: 16px;
  height: 16px;
}
@media (max-width: 479px) {
  .setup-banner__go {
    display: none;
  }
}
.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.active-filter {
  --hue: 243;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px 0 12px;
  border-radius: 99px;
  border: 1px solid hsl(var(--hue) 60% 55% / 0.4);
  background: hsl(var(--hue) 85% 55% / 0.1);
  color: hsl(var(--hue) 60% 38%);
  font-size: 0.82rem;
  font-weight: 700;
}
[data-theme='dark'] .active-filter {
  color: hsl(var(--hue) 85% 78%);
}
.active-filter svg {
  width: 15px;
  height: 15px;
}
.active-filter__x {
  opacity: 0.6;
}
.active-filter:hover .active-filter__x {
  opacity: 1;
}

.locate-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--primary-soft), color-mix(in srgb, var(--accent) 10%, transparent));
  border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
}
.locate-banner p {
  font-size: 0.86rem;
}
.locate-banner__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--primary);
  color: #fff;
}
.locate-banner__icon svg {
  width: 22px;
  height: 22px;
}

.results-count {
  color: var(--text);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.skeleton-card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  overflow: hidden;
}
.error-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius);
  background: var(--danger-soft);
  color: var(--danger);
}
.sentinel {
  display: grid;
  place-items: center;
  min-height: 48px;
  font-size: 0.88rem;
}

/* Sidebar mini profile */
.mini {
  overflow: hidden;
}
.mini__cover {
  height: 44px;
  background: linear-gradient(135deg, hsl(var(--hue) 75% 60%), hsl(calc(var(--hue) + 40) 70% 55%));
}
.mini__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  padding: 0 14px 12px;
}
.mini__avatar {
  margin-top: -28px;
}
.mini__name {
  font-size: 1rem;
}
.mini__body:hover .mini__name {
  color: var(--primary);
}
.mini__role {
  font-size: 0.82rem;
}
.mini__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  border-top: 1px solid var(--border);
  padding: 6px;
}
.mini__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--text-3);
}
.mini__stat:hover {
  background: var(--surface-2);
}
.mini__stat span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mini__stat svg {
  width: 14px;
  height: 14px;
}
.mini__stat strong {
  font-size: 0.9rem;
  color: var(--primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini__stat strong.hot {
  color: var(--danger);
}
.mini__stat strong.ok {
  color: var(--success);
}
.mini__stat strong.off {
  color: var(--text-3);
}

@media (max-width: 479px) {
  .filter-btn__text {
    display: none;
  }
  .filter-btn {
    padding: 0 14px;
  }
  .locate-banner {
    flex-wrap: wrap;
  }
  .locate-banner > :last-child {
    width: 100%;
  }
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  }
}

@media (min-width: 1024px) {
  .discover__side {
    display: flex;
  }
  .discover__side .side-filters {
    padding: 16px;
  }
  .filter-btn {
    display: none;
  }
}
</style>
