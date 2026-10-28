<script setup>
import { computed } from 'vue';
import { LocateFixed, Radar, Wifi, ArrowDownUp, BriefcaseBusiness } from 'lucide-vue-next';
import UiRange from './ui/UiRange.vue';
import UiToggle from './ui/UiToggle.vue';
import UiSelect from './ui/UiSelect.vue';
import UiButton from './ui/UiButton.vue';
import { DISTANCE_STEPS, RATE_STEPS } from '@/constants/filters';
import { formatMoney } from '@/utils/format';
import { useI18n } from 'vue-i18n';

const filters = defineModel({ type: Object, required: true });
defineProps({
  hasLocation: Boolean,
  locating: Boolean,
  locationError: { type: String, default: '' },
});
const emit = defineEmits(['enable-location', 'reset']);

const { t } = useI18n();
const sortOptions = computed(() =>
  ['recommended', 'distance', 'newest', 'connections', 'rating', 'rate'].map((value) => ({ value, label: t(`filters.sort.${value}`) })),
);

const rateOptions = computed(() =>
  RATE_STEPS.map((v) => ({ value: v ?? '', label: v == null ? t('filters.anyRate') : t('common.upTo', { amount: formatMoney(v) }) })),
);

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

const formatDistance = (i) => (DISTANCE_STEPS[i] == null ? t('common.anyDistance') : t('common.withinKm', { km: DISTANCE_STEPS[i] }));
</script>

<template>
  <div class="filters">
    <section class="filters__section">
      <h3 class="filters__title"><Radar /> {{ t('common.distance') }}</h3>
      <template v-if="hasLocation">
        <UiRange
          v-model="distanceIdx"
          :min="0"
          :max="DISTANCE_STEPS.length - 1"
          :step="1"
          :label="t('filters.radius')"
          :format="formatDistance"
          :marks="['1 km', t('filters.any')]"
        />
      </template>
      <div v-else class="filters__locate">
        <p>{{ t('filters.locateText') }}</p>
        <UiButton size="sm" variant="soft" :icon="LocateFixed" :loading="locating" @click="emit('enable-location')">
          {{ t('common.enableLocation') }}
        </UiButton>
        <p v-if="locationError" class="filters__error">{{ locationError }}</p>
      </div>
    </section>

    <section class="filters__section">
      <h3 class="filters__title"><BriefcaseBusiness /> {{ t('filters.hiring') }}</h3>
      <UiToggle v-model="availableOnly" :label="t('discover.available')" :description="t('filters.availableText')" />
      <UiSelect v-model="maxRate" :options="rateOptions" :label="t('filters.maxRate')" :aria-label="t('filters.maxRate')" />
    </section>

    <section class="filters__section">
      <h3 class="filters__title"><Wifi /> {{ t('filters.availability') }}</h3>
      <UiToggle v-model="onlineOnly" :label="t('filters.onlineNow')" :description="t('filters.onlineText')" />
    </section>

    <section class="filters__section">
      <h3 class="filters__title"><ArrowDownUp /> {{ t('common.sortBy') }}</h3>
      <UiSelect v-model="sort" :options="sortOptions" :aria-label="t('common.sortBy')" />
    </section>

    <UiButton variant="ghost" size="sm" block @click="emit('reset')">{{ t('common.resetFilters') }}</UiButton>
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