<script setup>
defineProps({
  width: { type: String, default: '100%' },
  height: { type: String, default: '14px' },
  radius: { type: String, default: '8px' },
});
</script>

<template>
  <span class="skeleton" :style="{ width, height, borderRadius: radius }" aria-hidden="true" />
</template>

<style scoped>
.skeleton {
  display: block;
  background: linear-gradient(90deg, var(--surface-3) 0%, var(--surface-2) 50%, var(--surface-3) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.3s ease-in-out infinite;
}
@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
</style>
