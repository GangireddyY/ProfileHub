<script setup>
import { reactive, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Mail, Lock, ArrowRight, ShieldHalf, Hourglass } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { errorMessage, fieldErrors } from '@/api/http';
import { needsOnboarding } from '@/utils/onboarding';
import { useI18n } from 'vue-i18n';
import UiInput from '@/components/ui/UiInput.vue';
import UiButton from '@/components/ui/UiButton.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const form = reactive({ email: '', password: '' });
const errors = ref({});
const formError = ref('');
const loading = ref(false);
const pendingNotice = ref(route.query.pending ? t('auth.pendingCreated') : '');
const switching = computed(() => Boolean(route.query.switch) && auth.isAuthed);

async function submit() {
  errors.value = {};
  formError.value = '';
  if (!form.email) errors.value.email = t('auth.emailRequired');
  if (!form.password) errors.value.password = t('auth.passwordRequired');
  if (Object.keys(errors.value).length) return;

  loading.value = true;
  pendingNotice.value = '';
  try {
    await auth.login(form);
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : null;
    router.replace(redirect || (needsOnboarding(auth.user) ? { name: 'welcome' } : '/'));
  } catch (err) {
    if (err.response?.data?.details?.code === 'pending_approval') {
      pendingNotice.value = errorMessage(err);
    } else {
      errors.value = fieldErrors(err);
      formError.value = errorMessage(err);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form class="stack" style="--gap: 20px" novalidate @submit.prevent="submit">
    <header class="auth-head">
      <h1 class="auth-title">{{ t('auth.welcomeBack') }}</h1>
      <p class="muted">{{ t('auth.loginLead') }}</p>
    </header>

    <div v-if="switching" class="switch-note" role="status">
      <ShieldHalf />
      <div class="grow">
        <strong>{{ route.query.switch === 'admin' ? t('auth.switchAdmin') : t('auth.switchOther') }}</strong>
        <p>{{ t('auth.switchText', { name: auth.user.name }) }}</p>
        <RouterLink to="/" class="link">{{ t('auth.backAs', { name: auth.user.name.split(' ')[0] }) }}</RouterLink>
      </div>
    </div>

    <div v-if="pendingNotice" class="pending-note" role="status">
      <Hourglass />
      <div>
        <strong>{{ t('auth.waiting') }}</strong>
        <p>{{ pendingNotice }}</p>
      </div>
    </div>
    <Transition name="fade">
      <p v-if="formError" class="form-alert" role="alert">{{ formError }}</p>
    </Transition>

    <div class="stack" style="--gap: 16px">
      <UiInput
        v-model="form.email"
        :label="t('auth.email')"
        type="email"
        :icon="Mail"
        :placeholder="t('auth.emailPlaceholder')"
        autocomplete="email"
        inputmode="email"
        :error="errors.email"
      />
      <div class="stack" style="--gap: 6px">
        <UiInput
          v-model="form.password"
          :label="t('auth.password')"
          type="password"
          :icon="Lock"
          :placeholder="t('auth.passwordPlaceholder')"
          autocomplete="current-password"
          :error="errors.password"
        />
        <RouterLink :to="{ name: 'forgot-password', query: form.email ? { email: form.email } : {} }" class="link forgot">
          {{ t('auth.forgot') }}
        </RouterLink>
      </div>
    </div>

    <UiButton type="submit" size="lg" block :loading="loading" :icon-right="ArrowRight">{{ t('auth.signIn') }}</UiButton>

    <p class="switch">
      {{ t('auth.newHere') }}
      <RouterLink :to="{ name: 'signup', query: route.query }" class="link">{{ t('auth.createAccount') }}</RouterLink>
    </p>
  </form>
</template>

<style scoped>
.forgot {
  align-self: flex-end;
  font-size: 0.84rem;
}
.switch-note {
  display: flex;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, var(--border));
  background: var(--warning-soft);
  font-size: 0.86rem;
}
.switch-note > svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--warning);
}
.switch-note p {
  margin: 2px 0 6px;
  color: var(--text-2);
}
.pending-note {
  display: flex;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
  background: var(--primary-soft);
  font-size: 0.88rem;
}
.pending-note > svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--primary);
}
.pending-note p {
  margin-top: 2px;
  color: var(--text-2);
}
</style>
