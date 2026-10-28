import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/http';
import { iconFor } from '@/constants/professions';

const withIcon = (p) => ({ ...p, icon: iconFor(p.icon), iconName: p.icon });

const humanize = (key = '') => key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) || 'Other';

export const useProfessionsStore = defineStore('professions', () => {
  const list = ref([]);
  const categories = ref([]);
  const loaded = ref(false);
  let pending = null;

  const byKey = computed(() => new Map(list.value.map((p) => [p.key, p])));
  const byCategory = computed(() => new Map(categories.value.map((c) => [c.key, c])));

  async function fetchCatalog() {
    const { data } = await api.get('/professions');
    list.value = data.professions.map(withIcon);
    categories.value = data.categories.map(withIcon);
    loaded.value = true;
  }

  function load() {
    if (loaded.value) return Promise.resolve();
    pending ||= fetchCatalog().finally(() => (pending = null));
    return pending;
  }

  function refresh() {
    pending = null;
    loaded.value = false;
    return load();
  }

  /** Unknown or retired keys still render (as a neutral badge) so old profiles never break. */
  function get(key) {
    const hit = byKey.value.get(key);
    if (hit) return hit;
    return { key, label: humanize(key), category: 'other', icon: iconFor('Briefcase'), iconName: 'Briefcase', hue: 220 };
  }

  function category(key) {
    return byCategory.value.get(key) || { key, label: humanize(key), icon: iconFor('Sparkles'), hue: 225 };
  }

  return { list, categories, loaded, load, refresh, get, category };
});
