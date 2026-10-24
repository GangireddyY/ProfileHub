<script setup>
import { PROFESSIONS } from '@/constants/professions';

const model = defineModel({ type: String, default: '' });
defineProps({
  label: { type: String, default: '' },
  error: { type: String, default: '' },
});
</script>

<template>
  <fieldset class="picker">
    <legend v-if="label" class="field__label">{{ label }}</legend>
    <div class="picker__grid" role="radiogroup">
      <button
        v-for="p in PROFESSIONS"
        :key="p.key"
        type="button"
        role="radio"
        class="picker__item"
        :class="{ 'is-active': model === p.key }"
        :aria-checked="model === p.key"
        :style="{ '--hue': p.hue }"
        @click="model = p.key"
      >
        <span class="picker__icon"><component :is="p.icon" /></span>
        <span class="picker__label">{{ p.label }}</span>
      </button>
    </div>
    <p v-if="error" class="field__msg field__msg--error">{{ error }}</p>
  </fieldset>
</template>

<style scoped>
.picker {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.picker__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 6px;
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
  background: var(--surface);
  transition: all 0.18s var(--ease);
}
.picker__item:hover {
  border-color: hsl(var(--hue) 60% 60%);
}
.picker__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: hsl(var(--hue) 85% 95%);
  color: hsl(var(--hue) 65% 42%);
  transition: all 0.18s var(--ease);
}
[data-theme='dark'] .picker__icon {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.picker__icon svg {
  width: 20px;
  height: 20px;
}
.picker__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-2);
}
.picker__item.is-active {
  border-color: hsl(var(--hue) 65% 52%);
  background: hsl(var(--hue) 85% 52% / 0.08);
  box-shadow: 0 0 0 3px hsl(var(--hue) 70% 55% / 0.18);
}
.picker__item.is-active .picker__icon {
  background: hsl(var(--hue) 65% 52%);
  color: #fff;
}
.picker__item.is-active .picker__label {
  color: var(--text);
}
</style>
