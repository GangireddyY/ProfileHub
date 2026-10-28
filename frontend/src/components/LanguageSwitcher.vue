<script setup>
import { useI18n } from 'vue-i18n';
import { Languages } from 'lucide-vue-next';
import { LANGUAGES } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/composables/useToast';
import { errorMessage } from '@/api/http';

/** `pills` shows every language as a button (Settings); `compact` is a small select for headers. */
defineProps({ variant: { type: String, default: 'compact' } });

const { t, locale } = useI18n();
const auth = useAuthStore();

async function choose(code) {
  if (code === locale.value) return;
  try {
    await auth.setLanguage(code);
    toast.success(t('lang.changed'));
  } catch (err) {
    toast.error(errorMessage(err));
  }
}
</script>

<template>
  <div v-if="variant === 'pills'" class="lang-pills" role="radiogroup" :aria-label="t('common.language')">
    <button
      v-for="l in LANGUAGES"
      :key="l.code"
      type="button"
      role="radio"
      class="lang-pill"
      :class="{ 'is-active': locale === l.code }"
      :aria-checked="locale === l.code"
      :lang="l.code"
      @click="choose(l.code)"
    >
      <strong>{{ l.native }}</strong>
      <span v-if="l.native !== l.label">{{ l.label }}</span>
    </button>
  </div>

  <label v-else class="lang-select">
    <Languages aria-hidden="true" />
    <select :value="locale" :aria-label="t('common.language')" @change="choose($event.target.value)">
      <option v-for="l in LANGUAGES" :key="l.code" :value="l.code" :lang="l.code">{{ l.native }}</option>
    </select>
  </label>
</template>

<style scoped>
.lang-select {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.lang-select svg {
  position: absolute;
  left: 10px;
  width: 16px;
  height: 16px;
  color: var(--text-3);
  pointer-events: none;
}
.lang-select select {
  height: 40px;
  padding: 0 12px 0 32px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.86rem;
  cursor: pointer;
}
.lang-select select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.lang-pills {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
}
.lang-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 8px;
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
  background: var(--surface);
  transition: all 0.18s var(--ease);
}
.lang-pill strong {
  font-size: 1rem;
}
.lang-pill span {
  font-size: 0.76rem;
  color: var(--text-3);
}
.lang-pill.is-active {
  border-color: var(--primary);
  box-shadow: var(--ring);
  color: var(--primary);
}
</style>
