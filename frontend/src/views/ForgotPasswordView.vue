<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Mail, ArrowRight, MailCheck } from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import UiInput from '@/components/ui/UiInput.vue';
import UiButton from '@/components/ui/UiButton.vue';

const { t } = useI18n();
const route = useRoute();

const email = ref(typeof route.query.email === 'string' ? route.query.email : '');
const error = ref('');
const formError = ref('');
const sent = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  formError.value = '';
  if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) {
    error.value = t('auth.enterEmail');
    return;
  }
  loading.value = true;
  try {
    const { data } = await api.post('/auth/forgot-password', { email: email.value.trim() });
    sent.value = data.message;
  } catch (err) {
    error.value = fieldErrors(err).email || '';
    formError.value = error.value ? '' : errorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="sent" class="stack done" style="--gap: 18px">
    <span class="done__icon"><MailCheck /></span>
    <header class="auth-head">
      <h1 class="auth-title">{{ t('auth.checkInbox') }}</h1>
      <p class="muted">{{ sent }}</p>
    </header>
    <UiButton to="/login" size="lg" block variant="secondary">{{ t('auth.backToSignIn') }}</UiButton>
  </div>

  <form v-else class="stack" style="--gap: 20px" novalidate @submit.prevent="submit">
    <header class="auth-head">
      <h1 class="auth-title">{{ t('auth.forgotTitle') }}</h1>
      <p class="muted">{{ t('auth.forgotLead') }}</p>
    </header>
    <Transition name="fade">
      <p v-if="formError" class="form-alert" role="alert">{{ formError }}</p>
    </Transition>
    <UiInput
      v-model="email"
      :label="t('auth.email')"
      type="email"
      :icon="Mail"
      :placeholder="t('auth.emailPlaceholder')"
      autocomplete="email"
      inputmode="email"
      :error="error"
    />
    <UiButton type="submit" size="lg" block :loading="loading" :icon-right="ArrowRight">{{ t('auth.sendLink') }}</UiButton>
    <p class="switch">
      <RouterLink to="/login" class="link">{{ t('auth.backToSignIn') }}</RouterLink>
    </p>
  </form>
</template>

<style scoped>
.done__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--primary-soft);
  color: var(--primary);
}
.done__icon svg {
  width: 26px;
  height: 26px;
}
</style>
