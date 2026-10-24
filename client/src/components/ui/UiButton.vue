<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import UiSpinner from './UiSpinner.vue';

const props = defineProps({
  /** primary | secondary | soft | ghost | danger | outline */
  variant: { type: String, default: 'primary' },
  /** sm | md | lg */
  size: { type: String, default: 'md' },
  icon: { type: [Object, Function], default: null },
  iconRight: { type: [Object, Function], default: null },
  iconOnly: Boolean,
  loading: Boolean,
  disabled: Boolean,
  block: Boolean,
  to: { type: [String, Object], default: null },
  type: { type: String, default: 'button' },
});

const isLink = computed(() => Boolean(props.to));
</script>

<template>
  <component
    :is="isLink ? RouterLink : 'button'"
    :to="isLink ? to : undefined"
    :type="isLink ? undefined : type"
    :disabled="isLink ? undefined : disabled || loading"
    :aria-busy="loading || undefined"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block, 'btn--icon': iconOnly }]"
  >
    <UiSpinner v-if="loading" :size="size === 'sm' ? 14 : 16" />
    <component :is="icon" v-else-if="icon" class="btn__icon" aria-hidden="true" />
    <span v-if="$slots.default" class="btn__label"><slot /></span>
    <component :is="iconRight" v-if="iconRight && !loading" class="btn__icon" aria-hidden="true" />
  </component>
</template>

<style scoped>
.btn {
  --h: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: var(--h);
  padding: 0 18px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-weight: 600;
  font-size: 0.92rem;
  white-space: nowrap;
  user-select: none;
  transition: background-color 0.18s var(--ease), border-color 0.18s var(--ease), color 0.18s var(--ease),
    box-shadow 0.18s var(--ease), transform 0.08s var(--ease);
}
.btn:active:not(:disabled) {
  transform: scale(0.97);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn:focus-visible {
  outline: none;
  box-shadow: var(--ring);
}

.btn--sm {
  --h: 34px;
  padding: 0 12px;
  font-size: 0.84rem;
  border-radius: 9px;
  gap: 6px;
}
.btn--lg {
  --h: 50px;
  padding: 0 24px;
  font-size: 1rem;
  border-radius: var(--radius);
}
.btn--block {
  width: 100%;
}
.btn--icon {
  width: var(--h);
  padding: 0;
}

.btn__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.btn--sm .btn__icon {
  width: 16px;
  height: 16px;
}

.btn--primary {
  background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 75%, var(--accent)));
  color: var(--primary-text);
  box-shadow: 0 6px 16px -6px color-mix(in srgb, var(--primary) 70%, transparent);
}
.btn--primary:hover:not(:disabled) {
  box-shadow: 0 10px 22px -8px color-mix(in srgb, var(--primary) 80%, transparent);
  filter: brightness(1.05);
}

.btn--secondary {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text);
  box-shadow: var(--shadow-xs);
}
.btn--secondary:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--surface-2);
}

.btn--outline {
  background: transparent;
  border-color: color-mix(in srgb, var(--primary) 55%, transparent);
  color: var(--primary);
}
.btn--outline:hover:not(:disabled) {
  background: var(--primary-soft);
}

.btn--soft {
  background: var(--primary-soft);
  color: var(--primary);
}
.btn--soft:hover:not(:disabled) {
  background: color-mix(in srgb, var(--primary) 18%, transparent);
}

.btn--ghost {
  background: transparent;
  color: var(--text-2);
}
.btn--ghost:hover:not(:disabled) {
  background: var(--surface-3);
  color: var(--text);
}

.btn--danger {
  background: var(--danger-soft);
  color: var(--danger);
}
.btn--danger:hover:not(:disabled) {
  background: var(--danger);
  color: #fff;
}
</style>
