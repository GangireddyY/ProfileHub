<script setup>
defineProps({
  as: { type: String, default: 'section' },
  padded: { type: Boolean, default: true },
  interactive: Boolean,
});
</script>

<template>
  <component :is="as" class="card" :class="{ 'card--padded': padded, 'card--interactive': interactive }">
    <slot />
  </component>
</template>

<style scoped>
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}
.card--padded {
  padding: clamp(16px, 2.5vw, 22px);
}
.card--interactive {
  transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease), border-color 0.2s var(--ease);
}
.card--interactive:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
  border-color: var(--border-strong);
}
</style>
