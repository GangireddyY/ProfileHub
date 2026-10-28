<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { CircleCheck, TriangleAlert, Mail } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import UiButton from '@/components/ui/UiButton.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSpinner from '@/components/ui/UiSpinner.vue';

const { t } = useI18n();
const route = useRoute();
const auth = useAuthStore();

const state = ref('loading');
const result = ref(null);
const error = ref('');
const email = ref('');
const resendMessage = ref('');
const resending = ref(false);

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  if (!token) {
    state.value = 'failed';
    error.value = t('auth.linkMissing');
    return;
  }
  try {
    const { data } = await api.post('/auth/verify-email', { token });
    result.value = data;
    state.value = 'done';
    if (auth.isAuthed) auth.fetchMe().catch(() => {});
  } catch (err) {
    state.value = 'failed';
    error.value = errorMessage(err);
  }
});

async function resend() {
  resending.value = true;
  resendMessage.value = '';
  try {
    const { data } = auth.isAuthed
      ? await api.post('/users/me/verify-email')
      : await api.post('/auth/resend-verification', { email: email.value.trim() });
    resendMessage.value = data.message || t('auth.checkInbox');
  } catch (err) {
    resendMessage.value = errorMessage(err);
  } finally {
    resending.value = false;
  }
}
</script>

<template>
  <div v-if="state === 'loading'" class="stack center" style="--gap: 16px">
    <UiSpinner :size="32" />
    <p class="muted">{{ t('auth.verifying') }}</p>
  </div>

  <div v-else-if="state === 'done'" class="stack" style="--gap: 18px">
    <span class="state-icon"><CircleCheck /></span>
    <header class="auth-head">
      <h1 class="auth-title">{{ t('auth.verified') }}</h1>
      <p class="muted">{{ result?.approved ? t('auth.verifiedApproved') : t('auth.verifiedPending') }}</p>
    </header>
    <UiButton :to="auth.isAuthed ? '/' : '/login'" size="lg" block>
      {{ auth.isAuthed ? t('auth.continue') : t('auth.signIn') }}
    </UiButton>
  </div>

  <div v-else class="stack" style="--gap: 18px">
    <span class="state-icon state-icon--bad"><TriangleAlert /></span>
    <header class="auth-head">
      <h1 class="auth-title">{{ t('auth.verifyFailed') }}</h1>
      <p class="muted">{{ error }}</p>
    </header>
    <form class="stack" style="--gap: 12px" novalidate @submit.prevent="resend">
      <strong>{{ t('auth.resendTitle') }}</strong>
      <UiInput
        v-if="!auth.isAuthed"
        v-model="email"
        :label="t('auth.email')"
        type="email"
        :icon="Mail"
        autocomplete="email"
        :placeholder="t('auth.emailPlaceholder')"
      />
      <UiButton type="submit" block :loading="resending" :disabled="!auth.isAuthed && !email.trim()">{{ t('auth.resend') }}</UiButton>
      <p v-if="resendMessage" class="muted" role="status">{{ resendMessage }}</p>
    </form>
    <p class="switch">
      <RouterLink to="/login" class="link">{{ t('auth.backToSignIn') }}</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.center {
  align-items: center;
  text-align: center;
  padding: 24px 0;
  color: var(--primary);
}
.state-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--success-soft, var(--primary-soft));
  color: var(--success);
}
.state-icon--bad {
  background: var(--danger-soft);
  color: var(--danger);
}
.state-icon svg {
  width: 26px;
  height: 26px;
}
</style>
