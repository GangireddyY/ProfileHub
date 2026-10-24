<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { toast } from '@/composables/useToast';
import UiToaster from '@/components/ui/UiToaster.vue';

const auth = useAuthStore();
const router = useRouter();
useThemeStore();

function onSessionExpired() {
  if (!auth.token) return;
  auth.logout();
  toast.error('Your session expired, please sign in again');
  router.push({ name: 'login' });
}

onMounted(() => window.addEventListener('auth:expired', onSessionExpired));
onBeforeUnmount(() => window.removeEventListener('auth:expired', onSessionExpired));
</script>

<template>
  <Transition name="fade">
    <div v-if="!auth.ready" class="splash" aria-label="Loading ProfileHUB">
      <img src="/favicon.svg" alt="" width="56" height="56" />
    </div>
  </Transition>
  <RouterView />
  <UiToaster />
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  background: var(--bg);
}
.splash img {
  border-radius: 16px;
  animation: breathe 1.4s var(--ease) infinite;
}
@keyframes breathe {
  50% {
    transform: scale(0.88);
    opacity: 0.7;
  }
}
</style>
