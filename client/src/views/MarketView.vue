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
import UiChip from '@/components/ui/UiChip.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import UiTabs from '@/components/ui/UiTabs.vue';
import ListingCard from '@/components/market/ListingCard.vue';
import MarketFilters from '@/components/market/MarketFilters.vue';

const DEFAULTS = { q: '', categories: [], conditions: [], minPrice: null, maxPrice: null, maxDistance: null, sort: 'newest' };

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
const sellerName = computed(() => (sellerId.value && items.value[0]?.seller?.name) || 'this member');
const activeFilterCount = computed(() => {
  const f = filters.value;
  return (f.conditions.length ? 1 : 0) + (f.minPrice != null || f.maxPrice != null ? 1 : 0) + (f.maxDistance != null ? 1 : 0) + (f.sort !== 'newest' ? 1 : 0);
});
const tabs = computed(() => [
  { key: 'browse', label: 'Browse', icon: Store },
  { key: 'mine', label: 'My listings', icon: Tag, count: myCount.value ?? undefined },
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

function toggleCategory(key) {
  const list = filters.value.categories;
  filters.value.categories = list.includes(key) ? list.filter((c) => c !== key) : [...list, key];
}

function resetFilters() {
  filters.value = { ...DEFAULTS, q: filters.value.q };
}

function clearSeller() {
  sellerId.value = '';
  load();
}

async function enableLocation() {
  if (await geo.locate()) toast.success('Location enabled');
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
        <strong>Got something to sell?</strong>
        <p class="muted">List it in a minute. Buyers can message you directly.</p>
        <UiButton to="/market/new" block :icon="Plus">Sell something</UiButton>
      </UiCard>
    </aside>

    <section class="page-main">
      <header class="page-head">
        <div>
          <h1 class="page-title">Marketplace</h1>
          <p class="muted">Buy and sell locally: vehicles, books, furniture, electronics and more.</p>
        </div>
        <UiButton to="/market/new" :icon="Plus" class="head-sell">Sell</UiButton>
      </header>

      <UiTabs v-model="tab" :tabs="tabs" />

      <div class="searchbar">
        <label class="searchbar__field">
          <Search class="searchbar__icon" />
          <input
            v-model.trim="filters.q"
            type="search"
            :placeholder="isMine ? 'Search your listings' : 'Search cars, phones, sofas, books…'"
            aria-label="Search listings"
            enterkeyhint="search"
          />
          <button v-if="filters.q" type="button" class="searchbar__clear" aria-label="Clear search" @click="filters.q = ''">
            <X />
          </button>
        </label>
        <button v-if="!isMine" type="button" class="filter-btn" aria-label="Open filters" @click="filtersOpen = true">
          <SlidersHorizontal />
          <span class="filter-btn__text">Filters</span>
          <span v-if="activeFilterCount" class="filter-btn__count">{{ activeFilterCount }}</span>
        </button>
      </div>

      <template v-if="!isMine">
        <div class="scroll-x chips" role="group" aria-label="Filter by category">
          <UiChip :active="!filters.categories.length" @click="filters.categories = []">All</UiChip>
          <UiChip
            v-for="c in LISTING_CATEGORIES"
            :key="c.key"
            :icon="c.icon"
            :hue="c.hue"
            :active="filters.categories.includes(c.key)"
            @click="toggleCategory(c.key)"
          >
            {{ c.label }}
          </UiChip>
        </div>

        <div v-if="sellerId" class="seller-filter">
          <UserRound /> Showing listings by <strong>{{ sellerName }}</strong>
          <button type="button" aria-label="Show all listings" @click="clearSeller"><X /></button>
        </div>
      </template>

      <div v-else-if="stats && items.length" class="my-stats">
        <div><strong>{{ stats.active }}</strong><span>Active</span></div>
        <div><strong>{{ stats.sold }}</strong><span>Sold</span></div>
        <div><strong><Eye /> {{ stats.views }}</strong><span>Total views</span></div>
      </div>

      <p v-if="!loading && !error" class="muted results">
        <strong>{{ total }}</strong> {{ total === 1 ? 'listing' : 'listings' }}
      </p>

      <div v-if="error" class="error-box">
        <p>{{ error }}</p>
        <UiButton size="sm" variant="secondary" @click="load()">Try again</UiButton>
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
          title="You haven't listed anything yet"
          description="Sell your old phone, bike, books or furniture to people nearby."
        >
          <UiButton to="/market/new" :icon="Plus">Create your first listing</UiButton>
        </UiEmpty>
        <UiEmpty v-else :icon="Store" title="Nothing matches" description="Try another category, widen the price range or clear your search.">
          <UiButton variant="secondary" @click="resetFilters(); filters.categories = []; filters.q = ''">Clear filters</UiButton>
        </UiEmpty>
      </UiCard>

      <TransitionGroup v-else name="list" tag="div" class="grid">
        <ListingCard v-for="l in items" :key="l.id" :listing="l" />
      </TransitionGroup>

      <div v-if="!loading && page < pages" class="more">
        <UiButton variant="secondary" :loading="loadingMore" @click="load({ append: true })">Load more</UiButton>
      </div>
    </section>

    <UiSheet v-model:open="filtersOpen" title="Filters" width="440px">
      <MarketFilters
        v-model="filters"
        :has-location="me.hasLocation"
        :locating="geo.loading.value"
        @reset="resetFilters"
        @enable-location="enableLocation"
      />
      <template #footer>
        <UiButton block @click="filtersOpen = false">Show {{ total }} results</UiButton>
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

.searchbar {
  display: flex;
  gap: 10px;
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
.chips {
  padding-bottom: 2px;
  margin-inline: calc(-1 * var(--page-pad));
  padding-inline: var(--page-pad);
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
  .chips {
    margin-inline: 0;
    padding-inline: 0;
  }
}
</style>
