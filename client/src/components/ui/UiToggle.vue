<script setup>
import UiSpinner from './UiSpinner.vue';

const model = defineModel({ type: Boolean, default: false });
defineProps({
  label: { type: String, default: '' },
  description: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  disabled: Boolean,
  loading: Boolean,
});
</script>

<template>
  <label class="toggle" :class="{ 'is-disabled': disabled || loading }">
    <span v-if="icon" class="toggle__icon"><component :is="icon" /></span>
    <span v-if="label || description" class="toggle__text">
      <span class="toggle__label">{{ label }}</span>
      <span v-if="description" class="toggle__desc">{{ description }}</span>
    </span>
    <UiSpinner v-if="loading" :size="16" class="toggle__spinner" />
    <span class="toggle__switch">
      <input v-model="model" type="checkbox" role="switch" :disabled="disabled || loading" :aria-checked="model" />
      <span class="toggle__track"><span class="toggle__thumb" /></span>
    </span>
  </label>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  padding: 4px 0;
}
.toggle.is-disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
.toggle__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--primary-soft);
  color: var(--primary);
  flex-shrink: 0;
}
.toggle__icon :deep(svg) {
  width: 20px;
  height: 20px;
}
.toggle__text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.toggle__label {
  font-weight: 600;
}
.toggle__desc {
  font-size: 0.85rem;
  color: var(--text-2);
}
.toggle__spinner {
  color: var(--primary);
}
.toggle__switch {
  position: relative;
  flex-shrink: 0;
}
.toggle__switch input {
  position: absolute;
  inset: 0;
  opacity: 0;
  margin: 0;
  cursor: inherit;
}
.toggle__track {
  display: block;
  width: 48px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--border-strong);
  position: relative;
  transition: background-color 0.2s var(--ease);
}
.toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: transform 0.22s var(--ease);
}
input:checked + .toggle__track {
  background: var(--primary);
}
input:checked + .toggle__track .toggle__thumb {
  transform: translateX(20px);
}
input:focus-visible + .toggle__track {
  box-shadow: var(--ring);
}
</style>
