<script setup>
import { ref, watch, onMounted, onBeforeUnmount, markRaw } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Search, MapPin, X, Loader2 } from 'lucide-vue-next';
import { reverseGeocode, searchPlaces, currentPosition, describeGeoError, shortPlaceLabel } from '@/composables/useGeolocation';
import { toast } from '@/composables/useToast';
import UiButton from './ui/UiButton.vue';

/**
 * Pick a precise spot: current position, a place search, or by clicking / dragging the pin.
 * Model: { latitude, longitude, label } or null.
 */
const model = defineModel({ type: Object, default: null });
const props = defineProps({
  /** Where the map opens when nothing is picked yet, e.g. the member's own location. */
  fallbackCenter: { type: Object, default: null },
});

const INDIA = { latitude: 20.5937, longitude: 78.9629 };
const mapEl = ref(null);
let map = null;
let marker = null;

const locating = ref(false);
const resolving = ref(false);
const query = ref('');
const results = ref([]);
const searching = ref(false);
const searchOpen = ref(false);

const pinIcon = L.divIcon({
  className: 'lp-pin',
  html: '<span class="lp-pin__dot"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function placeMarker(lat, lng, zoom) {
  if (!map) return;
  if (!marker) {
    marker = markRaw(L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map));
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      pick(p.lat, p.lng);
    });
  } else {
    marker.setLatLng([lat, lng]);
  }
  map.setView([lat, lng], zoom ?? Math.max(map.getZoom(), 15));
}

let resolveSeq = 0;
/** Set the spot, then look up its area name (the label buyers see). */
async function pick(latitude, longitude, label = '') {
  model.value = { latitude, longitude, label: label || model.value?.label || '' };
  placeMarker(latitude, longitude);
  if (label) return;
  const seq = ++resolveSeq;
  resolving.value = true;
  const place = await reverseGeocode(latitude, longitude);
  if (seq !== resolveSeq) return;
  resolving.value = false;
  if (place) model.value = { latitude, longitude, label: shortPlaceLabel(place) };
}

async function useCurrent() {
  locating.value = true;
  try {
    const pos = await currentPosition();
    await pick(pos.coords.latitude, pos.coords.longitude);
  } catch (err) {
    toast.error(describeGeoError(err));
  } finally {
    locating.value = false;
  }
}

let searchTimer;
let searchAbort;
watch(query, (q) => {
  clearTimeout(searchTimer);
  searchAbort?.abort();
  if (q.trim().length < 3) {
    results.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  // Nominatim asks for at most one request per second.
  searchTimer = setTimeout(async () => {
    searchAbort = new AbortController();
    try {
      results.value = await searchPlaces(q.trim(), { signal: searchAbort.signal });
      searchOpen.value = true;
    } catch (err) {
      if (err.name !== 'AbortError') results.value = [];
    } finally {
      searching.value = false;
    }
  }, 600);
});

function choose(r) {
  pick(r.latitude, r.longitude, shortPlaceLabel(r) || r.displayName.split(',').slice(0, 2).join(','));
  map?.setZoom(16);
  query.value = '';
  results.value = [];
  searchOpen.value = false;
}

function clear() {
  model.value = null;
  marker?.remove();
  marker = null;
}

onMounted(() => {
  const start = model.value || props.fallbackCenter || INDIA;
  map = markRaw(
    L.map(mapEl.value, { zoomControl: true, attributionControl: true }).setView(
      [start.latitude, start.longitude],
      model.value ? 15 : props.fallbackCenter ? 12 : 4,
    ),
  );
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  if (model.value) placeMarker(model.value.latitude, model.value.longitude, 15);
  map.on('click', (e) => pick(e.latlng.lat, e.latlng.lng));
  // The map may mount inside a layout that is still settling.
  setTimeout(() => map?.invalidateSize(), 200);
});

watch(
  () => model.value && [model.value.latitude, model.value.longitude],
  (coords, old) => {
    if (coords && (!old || coords[0] !== old[0] || coords[1] !== old[1]) && marker?.getLatLng().lat !== coords[0]) {
      placeMarker(coords[0], coords[1]);
    }
  },
);

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  searchAbort?.abort();
  map?.remove();
  map = null;
  marker = null;
});
</script>

<template>
  <div class="lp">
    <div class="lp__selected" :class="{ 'is-empty': !model }">
      <MapPin />
      <div class="grow" style="min-width: 0">
        <strong v-if="model">
          {{ model.label || 'Pinned location' }}
          <Loader2 v-if="resolving" class="lp__spin" aria-label="Looking up the area" />
        </strong>
        <strong v-else>No location picked</strong>
        <small v-if="model">{{ model.latitude.toFixed(5) }}, {{ model.longitude.toFixed(5) }}</small>
        <small v-else>Use your location, search, or tap the map.</small>
      </div>
      <button v-if="model" type="button" class="lp__clear" aria-label="Clear location" @click="clear"><X /></button>
    </div>

    <div class="lp__controls">
      <UiButton variant="soft" size="sm" :icon="LocateFixed" :loading="locating" @click="useCurrent">Use my current location</UiButton>
      <div class="lp__search">
        <Search class="lp__search-icon" />
        <input
          v-model="query"
          type="search"
          placeholder="Search an area or address"
          aria-label="Search an area or address"
          @focus="searchOpen = results.length > 0"
          @keydown.esc="searchOpen = false"
        />
        <Loader2 v-if="searching" class="lp__spin lp__search-spin" />
        <ul v-if="searchOpen && results.length" class="lp__results" role="listbox">
          <li v-for="r in results" :key="`${r.latitude},${r.longitude}`">
            <button type="button" @click="choose(r)">
              <strong>{{ shortPlaceLabel(r) || r.displayName.split(',')[0] }}</strong>
              <small>{{ r.displayName }}</small>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div ref="mapEl" class="lp__map" role="application" aria-label="Map: click to place the pin, drag it to adjust" />
    <p class="lp__hint">Tap the map or drag the pin to the exact spot. Buyers only see the area name and a rounded distance.</p>
  </div>
</template>

<style scoped>
.lp {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lp__selected {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--success-soft);
  border: 1px solid color-mix(in srgb, var(--success) 30%, var(--border));
}
.lp__selected.is-empty {
  background: var(--surface-2);
  border-color: var(--border);
}
.lp__selected > svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--success);
}
.lp__selected.is-empty > svg {
  color: var(--text-3);
}
.lp__selected strong {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}
.lp__selected small {
  display: block;
  font-size: 0.76rem;
  color: var(--text-3);
}
.lp__clear {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
}
.lp__clear:hover {
  background: var(--surface-3);
}
.lp__clear svg {
  width: 16px;
  height: 16px;
}
.lp__controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lp__search {
  position: relative;
}
.lp__search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  width: 16px;
  height: 16px;
  transform: translateY(-50%);
  color: var(--text-3);
  pointer-events: none;
}
.lp__search input {
  width: 100%;
  height: 40px;
  padding: 0 34px 0 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.9rem;
}
.lp__search input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.lp__search input::-webkit-search-cancel-button {
  display: none;
}
.lp__search-spin {
  position: absolute;
  right: 12px;
  top: 12px;
}
.lp__results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1000;
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.lp__results button {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
}
.lp__results button:hover {
  background: var(--surface-3);
}
.lp__results strong {
  font-size: 0.88rem;
}
.lp__results small {
  font-size: 0.74rem;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lp__map {
  height: 240px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
  z-index: 0;
}
.lp__hint {
  font-size: 0.78rem;
  color: var(--text-3);
}
.lp__spin {
  width: 15px;
  height: 15px;
  color: var(--text-3);
  animation: lp-spin 0.9s linear infinite;
}
@keyframes lp-spin {
  to {
    transform: rotate(360deg);
  }
}
.lp :deep(.lp-pin) {
  background: none;
  border: 0;
}
.lp :deep(.lp-pin__dot) {
  position: absolute;
  left: 3px;
  top: 0;
  width: 22px;
  height: 22px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  background: var(--primary);
  border: 3px solid #fff;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.35);
}
</style>
