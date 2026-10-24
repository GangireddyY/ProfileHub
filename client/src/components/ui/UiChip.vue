<script setup>
defineProps({
  active: Boolean,
  icon: { type: [Object, Function], default: null },
  /** Optional hue (0-360) to tint the chip, used for profession colours. */
  hue: { type: Number, default: null },
});
</script>

<template>
  <button
    type="button"
    class="chip"
    :class="{ 'is-active': active, 'chip--tinted': hue !== null }"
    :style="hue !== null ? { '--hue': hue } : undefined"
    :aria-pressed="active"
  >
    <component :is="icon" v-if="icon" class="chip__icon" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.86rem;
  white-space: nowrap;
  flex-shrink: 0;
  scroll-snap-align: start;
  transition: all 0.18s var(--ease);
}
.chip:hover {
  border-color: var(--border-strong);
  color: var(--text);
}
.chip__icon {
  width: 16px;
  height: 16px;
}
.chip.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.chip--tinted .chip__icon {
  color: hsl(var(--hue) 70% 50%);
}
.chip--tinted.is-active {
  background: hsl(var(--hue) 70% 50%);
  border-color: hsl(var(--hue) 70% 50%);
}
.chip--tinted.is-active .chip__icon {
  color: #fff;
}
</style>
