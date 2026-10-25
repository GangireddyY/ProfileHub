<script setup>
import { computed } from 'vue';
import { IndianRupee, Sparkle, Radar, ArrowDownUp, LocateFixed } from 'lucide-vue-next';
import { CONDITIONS, LISTING_SORTS } from '@/constants/marketplace';
import UiSelect from '../ui/UiSelect.vue';
import UiButton from '../ui/UiButton.vue';

const filters = defineModel({ type: Object, required: true });
const props = defineProps({
  hasLocation: Boolean,
  locating: Boolean,
});
const emit = defineEmits(['reset', 'enable-location']);

const DISTANCES = [null, 2, 5, 10, 25, 50, 100];
const distanceOptions = DISTANCES.map((d) => ({ value: d ?? '', label: d == null ? 'Any distance' : `Within ${d} km` }));
const sortOptions = computed(() => LISTING_SORTS.filter((s) => s.value !== 'distance' || props.hasLocation));

const set = (key, value) => (filters.value = { ...filters.value, [key]: value });
const field = (key, parse = (v) => v) =>
  computed({
    get: () => filters.value[key] ?? '',
    set: (v) => set(key, v === '' ? null : parse(v)),
  });

const minPrice = field('minPrice', Number);
const maxPrice = field('maxPrice', Number);
const maxDistance = field('maxDistance', Number);
const sort = computed({ get: () => filters.value.sort, set: (v) => set('sort', v) });

function toggleCondition(value) {
  const list = filters.value.conditions;
  set('conditions', list.includes(value) ? list.filter((c) => c !== value) : [...list, value]);
}
</script>

<template>
  <div class="mfilters">
    <section class="mfilters__section">
      <h3 class="mfilters__title"><IndianRupee /> Price</h3>
      <div class="price">
        <input v-model.lazy="minPrice" type="number" min="0" inputmode="numeric" placeholder="Min" aria-label="Minimum price" />
        <span class="subtle">to</span>
        <input v-model.lazy="maxPrice" type="number" min="0" inputmode="numeric" placeholder="Max" aria-label="Maximum price" />
      </div>
    </section>

    <section class="mfilters__section">
      <h3 class="mfilters__title"><Sparkle /> Condition</h3>
      <div class="conditions">
        <button
          v-for="c in CONDITIONS"
          :key="c.value"
          type="button"
          class="cond"
          :class="{ 'is-on': filters.conditions.includes(c.value) }"
          :aria-pressed="filters.conditions.includes(c.value)"
          @click="toggleCondition(c.value)"
        >
          {{ c.label }}
        </button>
      </div>
    </section>

    <section class="mfilters__section">
      <h3 class="mfilters__title"><Radar /> Distance</h3>
      <UiSelect v-if="hasLocation" v-model="maxDistance" :options="distanceOptions" aria-label="Distance" />
      <div v-else class="locate">
        <p>Share your location to see items near you.</p>
        <UiButton size="sm" variant="soft" :icon="LocateFixed" :loading="locating" @click="emit('enable-location')">
          Enable location
        </UiButton>
      </div>
    </section>

    <section class="mfilters__section">
      <h3 class="mfilters__title"><ArrowDownUp /> Sort by</h3>
      <UiSelect v-model="sort" :options="sortOptions" aria-label="Sort listings" />
    </section>

    <UiButton variant="ghost" size="sm" block @click="emit('reset')">Reset filters</UiButton>
  </div>
</template>

<style scoped>
.mfilters {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.mfilters__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mfilters__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
}
.mfilters__title svg {
  width: 16px;
  height: 16px;
}
.price {
  display: flex;
  align-items: center;
  gap: 8px;
}
.price input {
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 16px;
}
.price input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cond {
  height: 32px;
  padding: 0 12px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-size: 0.82rem;
  font-weight: 600;
  transition: all 0.15s var(--ease);
}
.cond:hover {
  border-color: var(--border-strong);
}
.cond.is-on {
  background: var(--primary-soft);
  border-color: color-mix(in srgb, var(--primary) 45%, transparent);
  color: var(--primary);
}
.locate {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px dashed var(--border-strong);
  font-size: 0.86rem;
  color: var(--text-2);
}
</style>
