<script setup>
import { Compass } from 'lucide-vue-next';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiButton from '@/components/ui/UiButton.vue';
</script>

<template>
  <div class="notfound">
    <span class="notfound__code">404</span>
    <UiEmpty :icon="Compass" title="This page wandered off" description="The link may be broken or the page may have moved.">
      <UiButton to="/">Back to ProfileHUB</UiButton>
    </UiEmpty>
  </div>
</template>

<style scoped>
.notfound {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.notfound__code {
  font-size: clamp(4rem, 14vw, 8rem);
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
</style>
