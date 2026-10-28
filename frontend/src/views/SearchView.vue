<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Search, X, Users, Store, BriefcaseBusiness, ArrowRight, SearchX, Sparkles } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { useProfessionsStore } from '@/stores/professions';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import UiTabs from '@/components/ui/UiTabs.vue';
import ProfileCard from '@/components/ProfileCard.vue';
import ListingCard from '@/components/market/ListingCard.vue';
import BackButton from '@/components/BackButton.vue';

const route = useRoute();
const router = useRouter();
const professions = useProfessionsStore();

const input = ref(null);
const q = ref(typeof route.query.q === 'string' ? route.query.q : '');
const tab = ref('all');
const result = ref(null);
const loading = ref(false);
const error = ref('');

const SUGGESTIONS = ['Electrician', 'Driver', 'Plumber', 'Tutor', 'Doctor', 'Bike', 'Sofa', 'iPhone', 'Books'];

const counts = computed(() => ({
  people: result.value?.people.total ?? 0,
  listings: result.value?.listings.total ?? 0,
  professions: result.value?.professions.length ?? 0,
}));
const tabs = computed(() => [
  { key: 'all', label: 'All', icon: Sparkles },
  { key: 'people', label: 'People', icon: Users, count: counts.value.people },
  { key: 'listings', label: 'For sale', icon: Store, count: counts.value.listings },
  { key: 'professions', label: 'Professions', icon: BriefcaseBusiness, count: counts.value.professions },
]);
const nothing = computed(() => result.value && !counts.value.people && !counts.value.listings && !counts.value.professions);
const show = (section) => tab.value === 'all' || tab.value === section;

let requestId = 0;
async function run(term) {
  const query = term.trim();
  if (!query) {
    result.value = null;
    return;
  }
  const id = ++requestId;
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/search', { params: { q: query, limit: tab.value === 'all' ? 8 : 24 } });
    if (id === requestId) result.value = data;
  } catch (err) {
    if (id === requestId) error.value = errorMessage(err);
  } finally {
    if (id === requestId) loading.value = false;
  }
}

let debounce;
watch(q, (value) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    router.replace({ query: value.trim() ? { q: value.trim() } : {} });
    run(value);
  }, 300);
});
watch(tab, () => run(q.value));
watch(
  () => route.query.q,
  (value) => {
    const next = typeof value === 'string' ? value : '';
    if (next !== q.value.trim()) q.value = next;
  },
);

function onCardChange(user, { status }) {
  user.connectionStatus = status;
}

onMounted(async () => {
  run(q.value);
  await nextTick();
  input.value?.focus();
});
</script>

<template>
  <div class="container search-page">
    <BackButton />
    <header class="hero">
      <h1 class="page-title">Search everything</h1>
      <p class="muted">People, professions and things for sale, all in one place.</p>
      <label class="bigsearch">
        <Search class="bigsearch__icon" />
        <input
          ref="input"
          v-model="q"
          type="search"
          placeholder="Try “electrician”, “Royal Enfield” or a person's name"
          aria-label="Search"
          enterkeyhint="search"
        />
        <button v-if="q" type="button" class="bigsearch__clear" aria-label="Clear search" @click="q = ''"><X /></button>
      </label>
      <div v-if="!q.trim()" class="suggest">
        <span class="subtle">Popular:</span>
        <button v-for="s in SUGGESTIONS" :key="s" type="button" class="suggest__chip" @click="q = s">{{ s }}</button>
      </div>
    </header>

    <template v-if="q.trim()">
      <UiTabs v-model="tab" :tabs="tabs" />

      <div v-if="error" class="error-box">{{ error }}</div>

      <div v-else-if="loading && !result" class="stack" style="--gap: 12px">
        <UiSkeleton width="200px" height="20px" />
        <div class="grid grid--people">
          <UiSkeleton v-for="i in 4" :key="i" height="260px" radius="20px" />
        </div>
      </div>

      <UiCard v-else-if="nothing">
        <UiEmpty :icon="SearchX" :title="`No results for “${q.trim()}”`" description="Check the spelling or try a broader word, like “driver” instead of “cab driver Indiranagar”.">
          <UiButton to="/market/new" variant="soft">Sell something</UiButton>
        </UiEmpty>
      </UiCard>

      <div v-else-if="result" class="sections" :class="{ 'is-loading': loading }">
        <section v-if="show('professions') && result.professions.length" class="section">
          <h2 class="section__title"><BriefcaseBusiness /> Professions</h2>
          <div class="profs">
            <RouterLink
              v-for="p in result.professions"
              :key="p.key"
              :to="{ path: '/', query: { profession: p.key } }"
              class="prof"
              :style="{ '--hue': p.hue }"
            >
              <span class="prof__icon"><component :is="professions.get(p.key).icon" /></span>
              <span class="prof__text">
                <strong>{{ p.label }}</strong>
                <small>{{ p.userCount }} {{ p.userCount === 1 ? 'person' : 'people' }} · {{ professions.category(p.category).label }}</small>
              </span>
              <ArrowRight class="prof__go" />
            </RouterLink>
          </div>
        </section>

        <section v-if="show('people') && result.people.items.length" class="section">
          <div class="section__head">
            <h2 class="section__title"><Users /> People <span class="subtle">· {{ result.people.total }}</span></h2>
            <UiButton
              v-if="result.people.total > result.people.items.length"
              :to="{ path: '/', query: { q: result.q } }"
              variant="ghost"
              size="sm"
              :icon-right="ArrowRight"
            >
              See all in Discover
            </UiButton>
          </div>
          <div class="grid grid--people">
            <ProfileCard v-for="u in result.people.items" :key="u.id" :user="u" @change="onCardChange(u, $event)" />
          </div>
        </section>

        <section v-if="show('listings') && result.listings.items.length" class="section">
          <div class="section__head">
            <h2 class="section__title"><Store /> For sale <span class="subtle">· {{ result.listings.total }}</span></h2>
            <UiButton
              v-if="result.listings.total > result.listings.items.length"
              :to="{ path: '/market', query: { q: result.q } }"
              variant="ghost"
              size="sm"
              :icon-right="ArrowRight"
            >
              See all in Marketplace
            </UiButton>
          </div>
          <div class="grid grid--listings">
            <ListingCard v-for="l in result.listings.items" :key="l.id" :listing="l" />
          </div>
        </section>

        <UiCard v-if="tab !== 'all' && !counts[tab]">
          <UiEmpty compact :icon="SearchX" title="Nothing in this tab" description="Try the All tab or another search." />
        </UiCard>
      </div>
    </template>
  </div>
</template>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.hero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bigsearch {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 10px;
}
.bigsearch__icon {
  position: absolute;
  left: 18px;
  width: 22px;
  height: 22px;
  color: var(--text-3);
  pointer-events: none;
}
.bigsearch input {
  width: 100%;
  height: 58px;
  padding: 0 52px 0 54px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 17px;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.bigsearch input::-webkit-search-cancel-button {
  display: none;
}
.bigsearch input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.bigsearch__clear {
  position: absolute;
  right: 10px;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--text-3);
}
.bigsearch__clear svg {
  width: 20px;
  height: 20px;
}
.suggest {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 0.86rem;
}
.suggest__chip {
  height: 32px;
  padding: 0 12px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-weight: 600;
}
.suggest__chip:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.sections {
  display: flex;
  flex-direction: column;
  gap: 26px;
  transition: opacity 0.2s;
}
.sections.is-loading {
  opacity: 0.6;
}
.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.section__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 700;
}
.section__title svg {
  width: 19px;
  height: 19px;
  color: var(--primary);
}
.profs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}
.prof {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  transition: border-color 0.15s, transform 0.15s var(--ease);
}
.prof:hover {
  border-color: hsl(var(--hue) 60% 60%);
  transform: translateY(-2px);
}
.prof__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  background: hsl(var(--hue) 85% 95%);
  color: hsl(var(--hue) 60% 42%);
}
[data-theme='dark'] .prof__icon {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.prof__icon svg {
  width: 20px;
  height: 20px;
}
.prof__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.prof__text small {
  color: var(--text-3);
  font-size: 0.78rem;
}
.prof__go {
  width: 18px;
  height: 18px;
  color: var(--text-3);
}
.grid {
  display: grid;
  gap: 16px;
}
.grid--people {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
.grid--listings {
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
}
.error-box {
  padding: 16px;
  border-radius: var(--radius);
  background: var(--danger-soft);
  color: var(--danger);
}
@media (max-width: 479px) {
  .grid--listings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}
</style>
