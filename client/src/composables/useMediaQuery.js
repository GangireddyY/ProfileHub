import { ref, onMounted, onBeforeUnmount } from 'vue';

export function useMediaQuery(query) {
  const mql = window.matchMedia(query);
  const matches = ref(mql.matches);
  const update = (e) => (matches.value = e.matches);
  onMounted(() => mql.addEventListener('change', update));
  onBeforeUnmount(() => mql.removeEventListener('change', update));
  return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
