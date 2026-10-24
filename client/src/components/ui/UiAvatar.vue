<script setup>
import { ref, computed, watch } from 'vue';
import { initials, hashHue } from '@/utils/format';

const props = defineProps({
  name: { type: String, default: '' },
  src: { type: String, default: '' },
  size: { type: Number, default: 40 },
  /** true = online dot, false = offline dot, null = no indicator */
  online: { type: Boolean, default: null },
  ring: Boolean,
});

const failed = ref(false);
watch(() => props.src, () => (failed.value = false));

const hue = computed(() => hashHue(props.name));
const style = computed(() => ({
  '--size': `${props.size}px`,
  '--hue': hue.value,
}));
const dotSize = computed(() => Math.max(10, Math.round(props.size * 0.26)));
</script>

<template>
  <span class="avatar" :class="{ 'avatar--ring': ring }" :style="style">
    <img v-if="src && !failed" :src="src" :alt="name" loading="lazy" @error="failed = true" />
    <span v-else class="avatar__initials" aria-hidden="true">{{ initials(name) }}</span>
    <span
      v-if="online !== null"
      class="avatar__dot"
      :class="online ? 'is-online' : 'is-offline'"
      :style="{ width: `${dotSize}px`, height: `${dotSize}px` }"
      :aria-label="online ? 'Online' : 'Offline'"
    />
  </span>
</template>

<style scoped>
.avatar {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: var(--size);
  height: var(--size);
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, hsl(var(--hue) 75% 62%), hsl(calc(var(--hue) + 40) 70% 52%));
  color: #fff;
  font-weight: 700;
  font-size: calc(var(--size) * 0.38);
  letter-spacing: 0.02em;
  user-select: none;
}
.avatar--ring {
  box-shadow: 0 0 0 4px var(--surface);
}
.avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.avatar__dot {
  position: absolute;
  right: 2%;
  bottom: 2%;
  border-radius: 50%;
  border: 2px solid var(--surface);
}
.avatar__dot.is-online {
  background: var(--success);
}
.avatar__dot.is-online::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 2px solid var(--success);
  animation: pulse 2s var(--ease) infinite;
}
.avatar__dot.is-offline {
  background: var(--text-3);
}
@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}
</style>
