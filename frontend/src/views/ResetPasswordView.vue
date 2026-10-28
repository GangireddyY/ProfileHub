<script setup>
import { reactive, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Lock, CircleCheck, TriangleAlert } from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import UiInput from '@/components/ui/UiInput.vue';
import UiButton from '@/components/ui/UiButton.vue';

const { t } = useI18n();
const route = useRoute();
const auth = useAuthStore();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const form = reactive({ password: '', confirm: '' });
const errors = ref({});
const formError = ref('');
const loading = ref(false);
const done = ref(null);

async function submit() {
  errors.value = {};
  formError.value = '';
  if (form.password.length < 8) errors.value.password = t('auth.min8');
  if (form.password !== form.confirm) errors.value.confirm = t('auth.mismatch');
  if (Object.keys(errors.value).length) return;
  loading.value = true;
  try {
    const { data } = await api.post('/auth/reset-password', { token: token.value, password: form.password });
    done.value = data;
    // Every session was ended on the server, including this tab's if it was signed in.
    if (auth.isAuthed) auth.dropSession();
  } catch (err) {
    errors.value = fieldErrors(err);
    if (!errors.value.password) formError.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="!token" class="stack" style="--gap: 18px">
    <span class="state-icon state-icon--bad"><TriangleAlert /></span>
    <header class="auth-head">
      <h1 class="auth-title">{{ t('auth.resetTitle') }}</h1>
      <p class="muted">{{ t('auth.linkMissing') }}</p>
    </header>
    <UiButton to="/forgot-password" size="lg" block>{{ t('auth.resend') }}</UiButton>
  </div>

  <div v-else-if="done" class="stack" style="--gap: 18px">
    <span class="state-icon"><CircleCheck /></span>
    <header class="auth-head">
      <h1 class="auth-title">{{ t('auth.resetTitle') }}</h1>
      <p class="muted">{{ done.canSignIn ? t('auth.resetDone') : done.message }}</p>
    </header>
    <UiButton to="/login" size="lg" block>{{ t('auth.signIn') }}</UiButton>
  </div>

  <form v-else class="stack" style="--gap: 20px" novalidate @submit.prevent="submit">
    <header class="auth-head">
      <h1 class="auth-title">{{ t('auth.resetTitle') }}</h1>
      <p class="muted">{{ t('auth.resetLead') }}</p>
    </header>
    <Transition name="fade">
      <div v-if="formError" class="form-alert" role="alert">
        {{ formError }}
        <RouterLink to="/forgot-password" class="link">{{ t('auth.resend') }}</RouterLink>
      </div>
    </Transition>
    <UiInput
      v-model="form.password"
      :label="t('auth.newPassword')"
      type="password"
      :icon="Lock"
      :placeholder="t('auth.passwordHint')"
      autocomplete="new-password"
      :error="errors.password"
    />
    <UiInput
      v-model="form.confirm"
      :label="t('auth.confirmPassword')"
      type="password"
      :icon="Lock"
      autocomplete="new-password"
      :error="errors.confirm"
    />
    <UiButton type="submit" size="lg" block :loading="loading">{{ t('auth.setPassword') }}</UiButton>
  </form>
</template>

<style scoped>
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
.form-alert .link {
  display: block;
  margin-top: 6px;
}
</style>
