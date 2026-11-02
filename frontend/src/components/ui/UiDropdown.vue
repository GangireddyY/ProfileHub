<script setup>
import { ref, reactive, nextTick, onBeforeUnmount } from 'vue';

const props = defineProps({ align: { type: String, default: 'right' } });

/**
 * The menu is teleported to <body> with fixed positioning, so cards with `overflow: hidden`
 * (profile header, chat scroller, plan cards) can't clip it. It opens below the trigger,
 * flips above when there isn't room, and stays inside the viewport.
 */
const GAP = 8;
const EDGE = 8;

const open = ref(false);
const root = ref(null);
const menu = ref(null);
const pos = reactive({ top: 0, left: 0, maxHeight: 0, placement: 'bottom', ready: false });

function place() {
  const trigger = root.value?.getBoundingClientRect();
  const el = menu.value;
  if (!trigger || !el) return;
  // The trigger scrolled out of view: nothing to anchor to.
  if (trigger.bottom < 0 || trigger.top > window.innerHeight) {
    close();
    return;
  }
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const width = el.offsetWidth;
  const height = el.scrollHeight;

  const preferred = props.align === 'left' ? trigger.left : trigger.right - width;
  pos.left = Math.min(Math.max(EDGE, preferred), Math.max(EDGE, vw - width - EDGE));

  const below = vh - trigger.bottom - GAP - EDGE;
  const above = trigger.top - GAP - EDGE;
  if (height <= below || below >= above) {
    pos.placement = 'bottom';
    pos.top = trigger.bottom + GAP;
    pos.maxHeight = below;
  } else {
    pos.placement = 'top';
    pos.maxHeight = above;
    pos.top = Math.max(EDGE, trigger.top - GAP - Math.min(height, above));
  }
  pos.ready = true;
}

let frame = 0;
function schedulePlace() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(place);
}

function onDocPointer(e) {
  if (root.value?.contains(e.target) || menu.value?.contains(e.target)) return;
  close();
}
function onKey(e) {
  if (e.key === 'Escape') close();
}

function listen(on) {
  const method = on ? 'addEventListener' : 'removeEventListener';
  document[method]('pointerdown', onDocPointer);
  document[method]('keydown', onKey);
  window[method]('resize', schedulePlace);
  // Capture so scrolling inside any container (chat, admin panels) keeps the menu attached.
  window[method]('scroll', schedulePlace, true);
}

async function show() {
  if (open.value) return;
  pos.ready = false;
  open.value = true;
  listen(true);
  await nextTick();
  place();
}
function close() {
  if (!open.value) return;
  open.value = false;
  listen(false);
  cancelAnimationFrame(frame);
}
const toggle = () => (open.value ? close() : show());

onBeforeUnmount(() => {
  listen(false);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <div ref="root" class="dropdown" :class="{ 'is-open': open }">
    <slot name="trigger" :open="open" :toggle="toggle" />
    <Teleport to="body">
      <Transition name="pop">
        <div
          v-if="open"
          ref="menu"
          class="dropdown__menu"
          :class="[`dropdown__menu--${pos.placement}`, { 'is-ready': pos.ready }]"
          :style="{ top: `${pos.top}px`, left: `${pos.left}px`, maxHeight: pos.maxHeight ? `${pos.maxHeight}px` : undefined }"
          role="menu"
          @click="close"
        >
          <slot :close="close" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
}
.dropdown__menu {
  position: fixed;
  z-index: 200;
  min-width: 240px;
  max-width: calc(100vw - 16px);
  padding: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  /* Measured before it's shown, so the first frame never appears in the wrong place. */
  visibility: hidden;
}
.dropdown__menu.is-ready {
  visibility: visible;
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
  white-space: nowrap;
}
.dropdown__menu :deep(.menu-item:hover) {
  background: var(--surface-3);
}
.dropdown__menu :deep(.menu-item svg) {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
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
}
.dropdown__menu--bottom {
  transform-origin: top center;
}
.dropdown__menu--top {
  transform-origin: bottom center;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
}
.pop-enter-from.dropdown__menu--bottom,
.pop-leave-to.dropdown__menu--bottom {
  transform: scale(0.96) translateY(-4px);
}
.pop-enter-from.dropdown__menu--top,
.pop-leave-to.dropdown__menu--top {
  transform: scale(0.96) translateY(4px);
}
</style>
