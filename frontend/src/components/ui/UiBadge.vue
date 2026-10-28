<script setup>
defineProps({
  /** neutral | primary | success | danger | warning */
  tone: { type: String, default: 'neutral' },
  icon: { type: [Object, Function], default: null },
  dot: Boolean,
});
</script>

<template>
  <span class="badge" :class="`badge--${tone}`">
    <span v-if="dot" class="badge__dot" />
    <component :is="icon" v-if="icon" class="badge__icon" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-full);
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
}
.badge__icon {
  width: 13px;
  height: 13px;
}
.badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.badge--neutral {
  background: var(--surface-3);
  color: var(--text-2);
}
.badge--primary {
  background: var(--primary-soft);
  color: var(--primary);
}
.badge--success {
  background: var(--success-soft);
  color: var(--success);
}
.badge--danger {
  background: var(--danger-soft);
  color: var(--danger);
}
.badge--warning {
  background: var(--warning-soft);
  color: var(--warning);
}
</style>
