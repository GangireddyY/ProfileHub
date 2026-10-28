<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { UserPlus, Clock, Check, X, MessageCircle, Undo2 } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { toast } from '@/composables/useToast';
import UiButton from './ui/UiButton.vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  /** Needs id, name, connectionStatus and (for incoming) connectionId. */
  user: { type: Object, required: true },
  size: { type: String, default: 'md' },
  block: Boolean,
});
const emit = defineEmits(['change']);

const { t } = useI18n();
const busy = ref(null);
const confirmWithdraw = ref(false);
let confirmTimer;

async function run(kind, request, next, message) {
  busy.value = kind;
  try {
    const { data } = await request();
    emit('change', { status: data.status ?? next });
    if (message) toast.success(message);
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = null;
  }
}

const connect = () =>
  run('connect', () => api.post(`/connections/${props.user.id}`), 'outgoing', t('connect.sent', { name: props.user.name }));

const accept = () =>
  run(
    'accept',
    () => api.post(`/connections/requests/${props.user.connectionId}/accept`),
    'connected',
    t('connect.connected', { name: props.user.name }),
  );

const decline = () => run('decline', () => api.post(`/connections/requests/${props.user.connectionId}/decline`), 'none');

/** Two-step withdraw so a stray tap on touch screens doesn't cancel the invite. */
function withdraw() {
  if (!confirmWithdraw.value) {
    confirmWithdraw.value = true;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => (confirmWithdraw.value = false), 3000);
    return;
  }
  confirmWithdraw.value = false;
  run('withdraw', () => api.delete(`/connections/${props.user.id}`), 'none', t('connect.withdrawn'));
}

onBeforeUnmount(() => clearTimeout(confirmTimer));
</script>

<template>
  <div class="connect" :class="{ 'connect--block': block }">
    <template v-if="user.connectionStatus === 'connected'">
      <UiButton variant="soft" :size="size" :icon="MessageCircle" :block="block" :to="`/messages/${user.id}`">
        {{ t('common.message') }}
      </UiButton>
    </template>

    <template v-else-if="user.connectionStatus === 'incoming'">
      <UiButton :size="size" :icon="Check" :loading="busy === 'accept'" :disabled="!!busy" class="grow" @click="accept">
        {{ t('connect.accept') }}
      </UiButton>
      <UiButton
        variant="secondary"
        :size="size"
        :icon="X"
        icon-only
        :aria-label="t('connect.ignore')"
        :loading="busy === 'decline'"
        :disabled="!!busy"
        @click="decline"
      />
    </template>

    <template v-else-if="user.connectionStatus === 'outgoing'">
      <UiButton
        :variant="confirmWithdraw ? 'danger' : 'secondary'"
        :size="size"
        :icon="confirmWithdraw ? Undo2 : Clock"
        :block="block"
        :loading="busy === 'withdraw'"
        @click="withdraw"
      >
        {{ confirmWithdraw ? t('connect.tapWithdraw') : t('connect.pending') }}
      </UiButton>
    </template>

    <template v-else>
      <UiButton variant="outline" :size="size" :icon="UserPlus" :block="block" :loading="busy === 'connect'" @click="connect">
        {{ t('connect.connect') }}
      </UiButton>
    </template>
  </div>
</template>

<style scoped>
.connect {
  display: flex;
  gap: 8px;
}
.connect--block {
  width: 100%;
}
.connect--block > :deep(*) {
  flex: 1;
}
.connect--block > :deep(.btn--icon) {
  flex: 0 0 auto;
}
</style>
