<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Search, X, SlidersHorizontal, Plus, Store, PackageOpen, Tag, Eye, UserRound } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useGeolocation } from '@/composables/useGeolocation';
import { toast } from '@/composables/useToast';
import { LISTING_CATEGORIES } from '@/constants/marketplace';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiSearchSelect from '@/components/ui/UiSearchSelect.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import UiTabs from '@/components/ui/UiTabs.vue';
import ListingCard from '@/components/market/ListingCard.vue';
import MarketFilters from '@/components/market/MarketFilters.vue';
import { useI18n } from 'vue-i18n';

const DEFAULTS = { q: '', categories: [], conditions: [], minPrice: null, maxPrice: null, maxDistance: null, sort: 'newest' };

const { t } = useI18n();
const auth = useAuthStore();
const geo = useGeolocation();
const route = useRoute();
const me = computed(() => auth.user);

const tab = ref(route.query.tab === 'mine' ? 'mine' : 'browse');
const sellerId = ref(typeof route.query.seller === 'string' ? route.query.seller : '');
const filters = ref({ ...DEFAULTS, q: typeof route.query.q === 'string' ? route.query.q : '' });
const filtersOpen = ref(false);

const items = ref([]);
const total = ref(0);
const page = ref(1);
const pages = ref(1);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref('');
const myCount = ref(null);

const isMine = computed(() => tab.value === 'mine');
const sellerName = computed(() => (sellerId.value && items.value[0]?.seller?.name) || t('market.thisMember'));
const activeFilterCount = computed(() => {
  const f = filters.value;
  return (f.conditions.length ? 1 : 0) + (f.minPrice != null || f.maxPrice != null ? 1 : 0) + (f.maxDistance != null ? 1 : 0) + (f.sort !== 'newest' ? 1 : 0);
});
const tabs = computed(() => [
  { key: 'browse', label: t('market.browse'), icon: Store },
  { key: 'mine', label: t('market.mine'), icon: Tag, count: myCount.value ?? undefined },
]);
const stats = computed(() => {
  if (!isMine.value) return null;
  const active = items.value.filter((l) => l.status === 'active');
  return {
    active: active.length,
    sold: items.value.filter((l) => l.status === 'sold').length,
    views: items.value.reduce((s, l) => s + (l.viewCount || 0), 0),
  };
});

let requestId = 0;
async function load({ append = false } = {}) {
  const id = ++requestId;
  if (append) loadingMore.value = true;
  else loading.value = true;
  error.value = '';
  const f = filters.value;
  try {
    const { data } = await api.get('/listings', {
      params: isMine.value
        ? { sellerId: me.value.id, status: 'all', q: f.q || undefined, page: append ? page.value + 1 : 1, limit: 24 }
        : {
            q: f.q || undefined,
            categories: f.categories.join(',') || undefined,
            conditions: f.conditions.join(',') || undefined,
            minPrice: f.minPrice ?? undefined,
            maxPrice: f.maxPrice ?? undefined,
            maxDistance: f.maxDistance ?? undefined,
            sort: f.sort,
            sellerId: sellerId.value || undefined,
            page: append ? page.value + 1 : 1,
            limit: 24,
          },
    });
    if (id !== requestId) return;
    items.value = append ? [...items.value, ...data.items] : data.items;
    total.value = data.total;
    page.value = data.page;
    pages.value = data.pages;
    if (isMine.value) myCount.value = data.total;
  } catch (err) {
    if (id === requestId) error.value = errorMessage(err);
  } finally {
    if (id === requestId) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

async function loadMyCount() {
  try {
    const { data } = await api.get('/listings', { params: { sellerId: me.value.id, status: 'all', limit: 1 } });
    myCount.value = data.total;
  } catch {
    /* badge only */
  }
}

let debounce;
watch(
  filters,
  () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => load(), 280);
  },
  { deep: true },
);
watch(tab, () => load());

const categoryFilter = computed({
  get: () => ({ categories: filters.value.categories }),
  set: ({ categories }) => (filters.value.categories = categories),
});
const categoryGroups = computed(() => [{ key: 'categories', title: t('common.categories'), options: LISTING_CATEGORIES.map((c) => ({ ...c })) }]);

function resetFilters() {
  filters.value = { ...DEFAULTS, q: filters.value.q };
}

function clearSeller() {
  sellerId.value = '';
  load();
}

async function enableLocation() {
  if (await geo.locate()) toast.success(t('discover.locationOn'));
  else toast.error(geo.error.value);
}

onMounted(() => {
  load();
  loadMyCount();
});
</script>

<template>
  <div class="container page-layout">
    <aside class="page-aside page-aside--sticky market__aside">
      <UiCard>
        <MarketFilters
          v-model="filters"
          :has-location="me.hasLocation"
          :locating="geo.loading.value"
          @reset="resetFilters"
          @enable-location="enableLocation"
        />
      </UiCard>
      <UiCard class="sell-cta">
        <span class="sell-cta__icon"><PackageOpen /></span>
        <strong>{{ t('market.sellTitle') }}</strong>
        <p class="muted">{{ t('market.sellText') }}</p>
        <UiButton to="/market/new" block :icon="Plus">{{ t('market.sellSomething') }}</UiButton>
      </UiCard>
    </aside>

    <section class="page-main">
      <header class="page-head">
        <div>
          <h1 class="page-title">{{ t('market.title') }}</h1>
          <p class="muted">{{ t('market.lead') }}</p>
        </div>
        <UiButton to="/market/new" :icon="Plus" class="head-sell">{{ t('market.sell') }}</UiButton>
      </header>

      <UiTabs v-model="tab" :tabs="tabs" />

      <div class="page-toolbar">
        <label class="searchbar__field">
          <Search class="searchbar__icon" />
          <input
            v-model.trim="filters.q"
            type="search"
            :placeholder="isMine ? t('market.searchMine') : t('market.searchAll')"
            :aria-label="t('market.searchLabel')"
            enterkeyhint="search"
          />
          <button v-if="filters.q" type="button" class="searchbar__clear" :aria-label="t('common.clearSearch')" @click="filters.q = ''">
            <X />
          </button>
        </label>
        <UiSearchSelect
          v-if="!isMine"
          v-model="categoryFilter"
          :groups="categoryGroups"
          :all-label="t('common.allCategories')"
          :placeholder="t('market.catPlaceholder')"
        />
        <button v-if="!isMine" type="button" class="filter-btn" :aria-label="t('common.filters')" @click="filtersOpen = true">
          <SlidersHorizontal />
          <span class="filter-btn__text">{{ t('common.filters') }}</span>
          <span v-if="activeFilterCount" class="filter-btn__count">{{ activeFilterCount }}</span>
        </button>
      </div>

      <div v-if="!isMine && sellerId" class="seller-filter">
        <UserRound /> {{ t('market.showingBy') }} <strong>{{ sellerName }}</strong>
        <button type="button" :aria-label="t('market.showAll')" @click="clearSeller"><X /></button>
      </div>

      <div v-if="stats && items.length" class="my-stats">
        <div><strong>{{ stats.active }}</strong><span>{{ t('market.active') }}</span></div>
        <div><strong>{{ stats.sold }}</strong><span>{{ t('market.sold') }}</span></div>
        <div><strong><Eye /> {{ stats.views }}</strong><span>{{ t('market.views') }}</span></div>
      </div>

      <p v-if="!loading && !error" class="muted results">
        <strong>{{ t('market.count', total) }}</strong>
      </p>

      <div v-if="error" class="error-box">
        <p>{{ error }}</p>
        <UiButton size="sm" variant="secondary" @click="load()">{{ t('common.tryAgain') }}</UiButton>
      </div>

      <div v-else-if="loading" class="grid">
        <div v-for="i in 8" :key="i" class="skeleton">
          <UiSkeleton height="auto" radius="0" style="aspect-ratio: 4 / 3" />
          <div class="stack" style="--gap: 8px; padding: 12px 14px 16px">
            <UiSkeleton width="40%" height="18px" />
            <UiSkeleton width="90%" height="13px" />
            <UiSkeleton width="60%" height="12px" />
          </div>
        </div>
      </div>

      <UiCard v-else-if="!items.length">
        <UiEmpty
          v-if="isMine"
          :icon="PackageOpen"
          :title="t('market.emptyMineTitle')"
          :description="t('market.emptyMineText')"
        >
          <UiButton to="/market/new" :icon="Plus">{{ t('market.firstListing') }}</UiButton>
        </UiEmpty>
        <UiEmpty v-else :icon="Store" :title="t('market.emptyTitle')" :description="t('market.emptyText')">
          <UiButton variant="secondary" @click="resetFilters(); filters.categories = []; filters.q = ''">{{ t('common.clearFilters') }}</UiButton>
        </UiEmpty>
      </UiCard>

      <TransitionGroup v-else name="list" tag="div" class="grid">
        <ListingCard v-for="l in items" :key="l.id" :listing="l" />
      </TransitionGroup>

      <div v-if="!loading && page < pages" class="more">
        <UiButton variant="secondary" :loading="loadingMore" @click="load({ append: true })">{{ t('common.loadMore') }}</UiButton>
      </div>
    </section>

    <UiSheet v-model:open="filtersOpen" :title="t('common.filters')" width="440px">
      <MarketFilters
        v-model="filters"
        :has-location="me.hasLocation"
        :locating="geo.loading.value"
        @reset="resetFilters"
        @enable-location="enableLocation"
      />
      <template #footer>
        <UiButton block @click="filtersOpen = false">{{ t('common.showResults', { n: total }) }}</UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.market__aside {
  display: none;
}
.sell-cta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  background: linear-gradient(135deg, var(--primary-soft), color-mix(in srgb, var(--accent) 10%, var(--surface)));
}
.sell-cta p {
  font-size: 0.86rem;
  margin-bottom: 6px;
}
.sell-cta__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
}
.sell-cta__icon svg {
  width: 22px;
  height: 22px;
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
.seller-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--primary-soft);
  color: var(--text-2);
  font-size: 0.9rem;
}
.seller-filter > svg {
  width: 18px;
  height: 18px;
  color: var(--primary);
}
.seller-filter button {
  margin-left: auto;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
}
.seller-filter button svg {
  width: 16px;
  height: 16px;
}
.my-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.my-stats > div {
  display: flex;
  flex-direction: column;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
}
.my-stats strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 1.3rem;
  font-weight: 800;
}
.my-stats strong svg {
  width: 18px;
  height: 18px;
  color: var(--text-3);
}
.my-stats span {
  font-size: 0.8rem;
  color: var(--text-3);
}
.results strong {
  color: var(--text);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 16px;
}
.skeleton {
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
.more {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

@media (max-width: 479px) {
  .filter-btn__text {
    display: none;
  }
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}

@media (min-width: 1024px) {
  .market__aside {
    display: flex;
  }
  .filter-btn,
  .head-sell {
    display: none;
  }
}
</style>
