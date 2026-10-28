<script setup>
import { watch, onBeforeUnmount, useId } from 'vue';
import { X } from 'lucide-vue-next';

/** Bottom sheet on phones; on larger screens a centred dialog, or a full-height drawer when `side` is 'right'. */
const open = defineModel('open', { type: Boolean, default: false });
defineProps({
  title: { type: String, default: '' },
  width: { type: String, default: '520px' },
  side: { type: String, default: 'center', validator: (v) => ['center', 'right'].includes(v) },
});

const titleId = useId();

function onKey(e) {
  if (e.key === 'Escape') open.value = false;
}

watch(open, (value) => {
  document.body.style.overflow = value ? 'hidden' : '';
  if (value) window.addEventListener('keydown', onKey);
  else window.removeEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', onKey);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-backdrop" :class="`is-${side}`" @click.self="open = false">
        <div class="sheet" role="dialog" aria-modal="true" :aria-labelledby="titleId" :style="{ '--w': width }">
          <div class="sheet__grip" aria-hidden="true" />
          <header class="sheet__head">
            <h2 :id="titleId" class="sheet__title">{{ title }}</h2>
            <button type="button" class="sheet__close" aria-label="Close" @click="open = false"><X /></button>
          </header>
          <div class="sheet__body"><slot /></div>
          <footer v-if="$slots.footer" class="sheet__foot"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(8, 12, 28, 0.5);
  backdrop-filter: blur(4px);
}
.sheet {
  width: 100%;
  max-height: 88dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-lg);
  padding-bottom: var(--safe-bottom);
}
.sheet__grip {
  width: 44px;
  height: 5px;
  border-radius: 99px;
  background: var(--border-strong);
  margin: 10px auto 0;
}
.sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 6px;
}
.sheet__title {
  font-size: 1.1rem;
  font-weight: 700;
}
.sheet__close {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: var(--surface-3);
  color: var(--text-2);
}
.sheet__close svg {
  width: 18px;
  height: 18px;
}
.sheet__body {
  padding: 12px 20px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.sheet__foot {
  display: flex;
  gap: 10px;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--border);
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s var(--ease);
}
.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.3s var(--ease);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}

@media (min-width: 768px) {
  .sheet-backdrop {
    align-items: center;
    padding: 24px;
  }
  .sheet {
    max-width: var(--w);
    border-radius: var(--radius-xl);
    padding-bottom: 0;
  }
  .sheet__grip {
    display: none;
  }
  .sheet__head {
    padding-top: 20px;
  }
  .sheet-enter-from .sheet,
  .sheet-leave-to .sheet {
    transform: translateY(16px) scale(0.98);
  }

  .sheet-backdrop.is-right {
    align-items: stretch;
    justify-content: flex-end;
    padding: 0;
    background: rgba(8, 12, 28, 0.25);
    backdrop-filter: none;
  }
  .is-right .sheet {
    max-width: min(var(--w), 100vw);
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    border-left: 1px solid var(--border);
  }
  .is-right .sheet__head {
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--border);
  }
  .is-right .sheet__body {
    flex: 1;
    padding-top: 18px;
  }
  .is-right .sheet__foot {
    background: var(--surface);
  }
  .sheet-enter-active.is-right .sheet,
  .sheet-leave-active.is-right .sheet {
    transition: transform 0.32s var(--ease);
  }
  .sheet-enter-from.is-right .sheet,
  .sheet-leave-to.is-right .sheet {
    transform: translateX(100%);
  }
}
</style>
