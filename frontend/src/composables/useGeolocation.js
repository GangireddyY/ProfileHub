import { ref } from 'vue';
import { errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const lookupHeaders = () => ({ 'Accept-Language': navigator.language || 'en' });

export function describeGeoError(err) {
  if (err?.code === 1) return 'Location permission was denied. Allow it in your browser or device settings.';
  if (err?.code === 2) return 'Your location could not be determined right now.';
  if (err?.code === 3) return 'Locating took too long, please try again.';
  return errorMessage(err);
}

const first = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() || '';

function placeFromNominatim(a = {}, displayName = '') {
  return {
    road: first(a.road, a.pedestrian, a.street),
    area: first(a.neighbourhood, a.suburb, a.quarter, a.residential, a.hamlet, a.village),
    city: first(a.city, a.town, a.village, a.municipality, a.county),
    district: first(a.city_district, a.state_district, a.county),
    state: first(a.state, a.region),
    postcode: first(a.postcode),
    country: first(a.country),
    countryCode: first(a.country_code).toUpperCase(),
    displayName: displayName.slice(0, 400),
  };
}

/** "Indiranagar, Bengaluru": what buyers and members see instead of an exact address. */
export const shortPlaceLabel = (place) => [place?.area, place?.city].filter(Boolean).join(', ') || place?.city || '';

/** Street-level address for a position, or null when the lookup fails. */
export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lon}`, {
      signal: AbortSignal.timeout(6000),
      headers: lookupHeaders(),
    });
    if (!res.ok) return null;
    const { address, display_name: displayName } = await res.json();
    return placeFromNominatim(address, displayName);
  } catch {
    return null;
  }
}

/** Free-text place search ("Indiranagar", "MG Road Bengaluru"): up to `limit` matches with coordinates. */
export async function searchPlaces(query, { limit = 6, signal } = {}) {
  const res = await fetch(
    `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(query)}`,
    { signal, headers: lookupHeaders() },
  );
  if (!res.ok) throw new Error('Place search is unavailable right now');
  const rows = await res.json();
  return rows.map((r) => ({
    latitude: Number(r.lat),
    longitude: Number(r.lon),
    ...placeFromNominatim(r.address, r.display_name),
  }));
}

/** The browser's current position, without saving it anywhere. */
export function currentPosition() {
  if (!('geolocation' in navigator)) return Promise.reject(new Error('Location is not supported on this device.'));
  if (!window.isSecureContext) return Promise.reject(new Error('Location needs a secure connection (HTTPS or localhost).'));
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60 * 1000 }),
  );
}

/** Ask the browser for the current position and store it on the profile. Resolves to true on success. */
export function useGeolocation() {
  const auth = useAuthStore();
  const loading = ref(false);
  const error = ref('');

  async function locate() {
    error.value = '';
    loading.value = true;
    try {
      const pos = await currentPosition();
      const { latitude, longitude, accuracy } = pos.coords;
      const place = await reverseGeocode(latitude, longitude);
      const details = { ...(place || {}), accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null };
      await auth.saveLocation({ latitude, longitude, ...(place?.city ? { city: place.city } : {}), details });
      return true;
    } catch (err) {
      error.value = describeGeoError(err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  return { locate, loading, error };
}
