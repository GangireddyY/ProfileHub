<script setup>
import { computed } from 'vue';
import { LocateFixed, Radar, Wifi, ArrowDownUp, BriefcaseBusiness } from 'lucide-vue-next';
import UiRange from './ui/UiRange.vue';
import UiToggle from './ui/UiToggle.vue';
import UiSelect from './ui/UiSelect.vue';
import UiButton from './ui/UiButton.vue';
import { DISTANCE_STEPS, RATE_STEPS } from '@/constants/filters';
import { formatMoney } from '@/utils/format';

const filters = defineModel({ type: Object, required: true });
defineProps({
  hasLocation: Boolean,
  locating: Boolean,
  locationError: { type: String, default: '' },
});
const emit = defineEmits(['enable-location', 'reset']);

const sortOptions = [
  { value: 'recommended', label: 'Recommended for you' },
  { value: 'distance', label: 'Nearest first' },
  { value: 'newest', label: 'Newest members' },
  { value: 'connections', label: 'Most connected' },
  { value: 'rate', label: 'Lowest rate first' },
];

const rateOptions = RATE_STEPS.map((v) => ({ value: v ?? '', label: v == null ? 'Any rate' : `Up to ${formatMoney(v)}` }));

const availableOnly = computed({
  get: () => filters.value.availableOnly,
  set: (v) => (filters.value = { ...filters.value, availableOnly: v }),
});
const maxRate = computed({
  get: () => filters.value.maxRate ?? '',
  set: (v) => (filters.value = { ...filters.value, maxRate: v === '' ? null : Number(v) }),
});

const distanceIdx = computed({
  get: () => filters.value.distanceIdx,
  set: (v) => (filters.value = { ...filters.value, distanceIdx: v }),
});
const onlineOnly = computed({
  get: () => filters.value.onlineOnly,
  set: (v) => (filters.value = { ...filters.value, onlineOnly: v }),
});
const sort = computed({
  get: () => filters.value.sort,
  set: (v) => (filters.value = { ...filters.value, sort: v }),
});

const formatDistance = (i) => (DISTANCE_STEPS[i] == null ? 'Any distance' : `Within ${DISTANCE_STEPS[i]} km`);
</script>

<template>
  <div class="filters">
    <section class="filters__section">
      <h3 class="filters__title"><Radar /> Distance</h3>
      <template v-if="hasLocation">
        <UiRange
          v-model="distanceIdx"
          :min="0"
          :max="DISTANCE_STEPS.length - 1"
          :step="1"
          label="Search radius"
          :format="formatDistance"
          :marks="['1 km', 'Any']"
        />
      </template>
      <div v-else class="filters__locate">
        <p>Share your location to see how far people are and filter by range.</p>
        <UiButton size="sm" variant="soft" :icon="LocateFixed" :loading="locating" @click="emit('enable-location')">
          Enable location
        </UiButton>
        <p v-if="locationError" class="filters__error">{{ locationError }}</p>
      </div>
    </section>

    <section class="filters__section">
      <h3 class="filters__title"><BriefcaseBusiness /> Hiring</h3>
      <UiToggle v-model="availableOnly" label="Available for work" description="People open to new jobs and bookings" />
      <UiSelect v-model="maxRate" :options="rateOptions" label="Maximum rate" aria-label="Maximum rate" />
    </section>

    <section class="filters__section">
      <h3 class="filters__title"><Wifi /> Availability</h3>
      <UiToggle v-model="onlineOnly" label="Online now" description="Only show people who are active right now" />
    </section>

    <section class="filters__section">
      <h3 class="filters__title"><ArrowDownUp /> Sort by</h3>
      <UiSelect v-model="sort" :options="sortOptions" aria-label="Sort results" />
    </section>

    <UiButton variant="ghost" size="sm" block @click="emit('reset')">Reset filters</UiButton>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.filters__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.filters__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
}
.filters__title svg {
  width: 16px;
  height: 16px;
}
.filters__locate {
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
.filters__error {
  color: var(--danger);
  font-size: 0.8rem;
}
</style>
