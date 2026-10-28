<script setup>
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import UiButton from './ui/UiButton.vue';

/**
 * Without `to`: returns to the previous in-app page, or `fallback` when the page was opened directly.
 * With `to`: goes to that page, stepping back in history when it is the previous entry.
 */
const props = defineProps({
  to: { type: [String, Object], default: null },
  fallback: { type: [String, Object], default: '/' },
  label: { type: String, default: 'Back' },
  iconOnly: Boolean,
});

const router = useRouter();

function goBack() {
  const previous = router.options.history.state.back;
  if (props.to) {
    if (previous === router.resolve(props.to).fullPath) router.back();
    else router.push(props.to);
  } else if (previous) {
    router.back();
  } else {
    router.push(props.fallback);
  }
}
</script>

<template>
  <UiButton
    variant="ghost"
    size="sm"
    :icon="ArrowLeft"
    :icon-only="iconOnly"
    :aria-label="iconOnly ? label : undefined"
    class="back-btn"
    @click="goBack"
  >
    <template v-if="!iconOnly">{{ label }}</template>
  </UiButton>
</template>

<style scoped>
.back-btn {
  align-self: flex-start;
  margin-left: -8px;
}
</style>
