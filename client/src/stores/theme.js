import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const KEY = 'ph_theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export const useThemeStore = defineStore('theme', () => {
  /** 'light' | 'dark' | 'system' */
  const mode = ref(localStorage.getItem(KEY) || 'system');
  const isDark = ref(false);

  function apply() {
    isDark.value = mode.value === 'dark' || (mode.value === 'system' && media.matches);
    document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark.value ? '#0b1020' : '#4f46e5');
  }

  function toggle() {
    mode.value = isDark.value ? 'light' : 'dark';
  }

  watch(mode, (value) => {
    localStorage.setItem(KEY, value);
    apply();
  });
  media.addEventListener('change', apply);
  apply();

  return { mode, isDark, toggle };
});
