<script setup>
import { ref, computed } from 'vue';
import { Navigation, RefreshCw, Lock, House, ExternalLink } from 'lucide-vue-next';
import { errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useGeolocation } from '@/composables/useGeolocation';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import UiButton from './ui/UiButton.vue';

/** Detailed view of the signed-in member's shared location. Only rendered for the owner. */
const emit = defineEmits(['address-saved']);

const auth = useAuthStore();
const geo = useGeolocation();
const me = computed(() => auth.user);

const loc = computed(() => me.value.locationDetails || {});
const title = computed(() => [loc.value.area, loc.value.city || me.value.city].filter(Boolean).join(', ') || 'Location set');
const subtitle = computed(() =>
  [[loc.value.state, loc.value.postcode].filter(Boolean).join(' '), loc.value.country].filter(Boolean).join(', '),
);
const rows = computed(() =>
  [
    { label: 'Street', value: loc.value.road },
    { label: 'Area', value: loc.value.area },
    { label: 'City', value: loc.value.city },
    { label: 'District', value: loc.value.district },
    { label: 'State', value: loc.value.state },
    { label: 'PIN code', value: loc.value.postcode },
    { label: 'Country', value: [loc.value.country, loc.value.countryCode && `(${loc.value.countryCode})`].filter(Boolean).join(' ') },
  ].filter((row) => row.value),
);
const coords = computed(() =>
  me.value.latitude != null ? `${me.value.latitude.toFixed(5)}, ${me.value.longitude.toFixed(5)}` : '',
);
const accuracy = computed(() => {
  const m = loc.value.accuracy;
  if (m == null) return '';
  return m >= 1000 ? `±${(m / 1000).toFixed(1)} km` : `±${m} m`;
});
const mapUrl = computed(() => {
  const { latitude: lat, longitude: lon } = me.value;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
});

const fullAddress = computed(() => (loc.value.displayName || '').slice(0, 300));
const canUseAsAddress = computed(() => Boolean(fullAddress.value) && me.value.address !== fullAddress.value);
const savingAddress = ref(false);

async function useAsAddress() {
  savingAddress.value = true;
  try {
    await auth.updateProfile({ address: fullAddress.value });
    emit('address-saved', me.value.address);
    toast.success('Address updated from your location');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    savingAddress.value = false;
  }
}

async function refresh() {
  if (await geo.locate()) toast.success('Location updated');
  else toast.error(geo.error.value);
}
</script>

<template>
  <div class="loc">
    <div class="loc__head">
      <Navigation />
      <div class="grow">
        <strong>{{ title }}</strong>
        <span class="muted">{{ subtitle || `Updated ${timeAgo(me.locationUpdatedAt)}` }}</span>
      </div>
      <UiButton variant="secondary" size="sm" :icon="RefreshCw" :loading="geo.loading.value" @click="refresh">Update</UiButton>
    </div>

    <dl class="loc__details">
      <div v-for="row in rows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
      <div v-if="coords">
        <dt>Coordinates</dt>
        <dd>{{ coords }}</dd>
      </div>
      <div v-if="accuracy">
        <dt>Accuracy</dt>
        <dd>{{ accuracy }}</dd>
      </div>
      <div>
        <dt>Updated</dt>
        <dd>{{ timeAgo(me.locationUpdatedAt) }}</dd>
      </div>
    </dl>
    <p v-if="loc.displayName" class="loc__address">{{ loc.displayName }}</p>
    <p v-else-if="!rows.length" class="loc__address">
      Address details aren't available for this position yet. Press Update to look them up.
    </p>

    <div class="loc__foot">
      <span><Lock /> Only you can see these details. Others see just your city and a rounded distance.</span>
      <div class="loc__actions">
        <UiButton v-if="canUseAsAddress" variant="soft" size="sm" :icon="House" :loading="savingAddress" @click="useAsAddress">
          Use as my address
        </UiButton>
        <a :href="mapUrl" target="_blank" rel="noopener noreferrer">Open in map <ExternalLink /></a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loc {
  border: 1px solid color-mix(in srgb, var(--success) 30%, var(--border));
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
}
.loc__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--success-soft);
}
.loc__head > svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--success);
}
.loc__head strong {
  display: block;
}
.loc__head span {
  font-size: 0.82rem;
}
.loc__details {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px 16px;
  margin: 0;
  padding: 14px;
}
.loc__details dt {
  font-size: 0.74rem;
  color: var(--text-3);
}
.loc__details dd {
  margin: 2px 0 0;
  font-weight: 600;
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}
.loc__address {
  margin: 0 14px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-size: 0.84rem;
  color: var(--text-2);
}
.loc__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 12px 14px;
  font-size: 0.8rem;
  color: var(--text-3);
}
.loc__foot > span,
.loc__actions > a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.loc__actions {
  display: flex;
  align-items: center;
  gap: 14px;
}
.loc__actions > a {
  color: var(--primary);
  font-weight: 600;
}
.loc__actions > a:hover {
  text-decoration: underline;
}
.loc__foot > span > svg,
.loc__actions > a > svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
