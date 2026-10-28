import { ref } from 'vue';
import { errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

function describe(err) {
  if (err?.code === 1) return 'Location permission was denied. Allow it in your browser or device settings.';
  if (err?.code === 2) return 'Your location could not be determined right now.';
  if (err?.code === 3) return 'Locating took too long, please try again.';
  return errorMessage(err);
}

const first = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() || '';

/** Street-level address for a position, or null when the lookup fails (the position is still saved). */
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lon}`,
      { signal: AbortSignal.timeout(6000), headers: { 'Accept-Language': navigator.language || 'en' } },
    );
    if (!res.ok) return null;
    const { address: a = {}, display_name: displayName = '' } = await res.json();
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
  } catch {
    return null;
  }
}

/** Ask the browser for the current position and store it on the profile. Resolves to true on success. */
export function useGeolocation() {
  const auth = useAuthStore();
  const loading = ref(false);
  const error = ref('');

  async function locate() {
    error.value = '';
    if (!('geolocation' in navigator)) {
      error.value = 'Location is not supported on this device.';
      return false;
    }
    if (!window.isSecureContext) {
      error.value = 'Location needs a secure connection (HTTPS or localhost).';
      return false;
    }

    loading.value = true;
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 60 * 1000,
        }),
      );
      const { latitude, longitude, accuracy } = pos.coords;
      const place = await reverseGeocode(latitude, longitude);
      const details = { ...(place || {}), accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null };
      await auth.saveLocation({ latitude, longitude, ...(place?.city ? { city: place.city } : {}), details });
      return true;
    } catch (err) {
      error.value = describe(err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  return { locate, loading, error };
}
