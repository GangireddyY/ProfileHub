<script setup>
import { computed } from 'vue';
import { getProfession } from '@/constants/professions';

const props = defineProps({
  profession: { type: String, required: true },
  size: { type: String, default: 'md' },
});
const p = computed(() => getProfession(props.profession));
</script>

<template>
  <span class="pbadge" :class="`pbadge--${size}`" :style="{ '--hue': p.hue }">
    <component :is="p.icon" class="pbadge__icon" aria-hidden="true" />
    {{ p.label }}
  </span>
</template>

<style scoped>
.pbadge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  border-radius: var(--radius-full);
  background: hsl(var(--hue) 85% 95%);
  color: hsl(var(--hue) 65% 38%);
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}
[data-theme='dark'] .pbadge {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.pbadge__icon {
  width: 15px;
  height: 15px;
}
.pbadge--sm {
  height: 24px;
  padding: 0 9px;
  font-size: 0.72rem;
}
.pbadge--sm .pbadge__icon {
  width: 13px;
  height: 13px;
}
</style>
