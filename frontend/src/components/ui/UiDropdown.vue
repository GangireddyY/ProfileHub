<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

defineProps({ align: { type: String, default: 'right' } });

const open = ref(false);
const root = ref(null);

function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false;
}
function onKey(e) {
  if (e.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocClick);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocClick);
  document.removeEventListener('keydown', onKey);
});

const close = () => (open.value = false);
</script>

<template>
  <div ref="root" class="dropdown">
    <slot name="trigger" :open="open" :toggle="() => (open = !open)" />
    <Transition name="pop">
      <div v-if="open" class="dropdown__menu" :class="`dropdown__menu--${align}`" role="menu" @click="close">
        <slot :close="close" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
}
.dropdown__menu {
  position: absolute;
  top: calc(100% + 8px);
  z-index: 60;
  min-width: 240px;
  padding: 6px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
}
.dropdown__menu--right {
  right: 0;
}
.dropdown__menu--left {
  left: 0;
}
.dropdown__menu :deep(.menu-item) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  font-weight: 500;
  font-size: 0.92rem;
  text-align: left;
  color: var(--text);
}
.dropdown__menu :deep(.menu-item:hover) {
  background: var(--surface-3);
}
.dropdown__menu :deep(.menu-item svg) {
  width: 18px;
  height: 18px;
  color: var(--text-2);
}
.dropdown__menu :deep(.menu-item--danger) {
  color: var(--danger);
}
.dropdown__menu :deep(.menu-item--danger svg) {
  color: var(--danger);
}
.dropdown__menu :deep(.menu-sep) {
  height: 1px;
  margin: 6px 4px;
  background: var(--border);
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.15s var(--ease), transform 0.15s var(--ease);
  transform-origin: top right;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
</style>
