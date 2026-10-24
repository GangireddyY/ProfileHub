import { ref } from 'vue';
import { errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

function describe(err) {
  if (err?.code === 1) return 'Location permission was denied. Allow it in your browser or device settings.';
  if (err?.code === 2) return 'Your location could not be determined right now.';
  if (err?.code === 3) return 'Locating took too long, please try again.';
  return errorMessage(err);
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat}&lon=${lon}`,
      { signal: AbortSignal.timeout(5000), headers: { 'Accept-Language': navigator.language || 'en' } },
    );
    const { address = {} } = await res.json();
    return address.city || address.town || address.village || address.county || address.state || undefined;
  } catch {
    return undefined;
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
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 5 * 60 * 1000,
        }),
      );
      const { latitude, longitude } = pos.coords;
      const city = await reverseGeocode(latitude, longitude);
      await auth.saveLocation({ latitude, longitude, ...(city ? { city } : {}) });
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
