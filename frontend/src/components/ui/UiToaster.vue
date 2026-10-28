<script setup>
import { useRouter } from 'vue-router';
import { CircleCheck, CircleAlert, Info, X } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';
import UiAvatar from './UiAvatar.vue';

const { toasts, dismiss } = useToast();
const router = useRouter();
const icons = { success: CircleCheck, error: CircleAlert, info: Info };

function runAction(t) {
  dismiss(t.id);
  if (t.action?.to) router.push(t.action.to);
}
</script>

<template>
  <div class="toaster" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.type}`" role="status">
        <UiAvatar v-if="t.avatar" :name="t.avatar.name" :src="t.avatar.avatarUrl" :size="36" />
        <component :is="icons[t.type]" v-else class="toast__icon" />
        <div class="toast__body">
          <strong v-if="t.title">{{ t.title }}</strong>
          <p>{{ t.message }}</p>
        </div>
        <button v-if="t.action" type="button" class="toast__action" @click="runAction(t)">{{ t.action.label }}</button>
        <button type="button" class="toast__close" aria-label="Dismiss" @click="dismiss(t.id)"><X /></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toaster {
  position: fixed;
  z-index: 200;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  left: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 420px;
  padding: 12px 12px 12px 14px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
}
.toast__icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.toast--success .toast__icon {
  color: var(--success);
}
.toast--error .toast__icon {
  color: var(--danger);
}
.toast--info .toast__icon {
  color: var(--primary);
}
.toast__body {
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
}
.toast__body strong {
  display: block;
  font-size: 0.9rem;
}
.toast__body p {
  color: var(--text-2);
}
.toast__action {
  border: 0;
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 700;
  font-size: 0.82rem;
  padding: 6px 12px;
  border-radius: 8px;
}
.toast__close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
}
.toast__close svg {
  width: 16px;
  height: 16px;
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s var(--ease);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.97);
}
.toast-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

@media (min-width: 768px) {
  .toaster {
    left: auto;
    right: 20px;
    top: calc(var(--nav-h) + 12px);
    align-items: flex-end;
  }
}
</style>
