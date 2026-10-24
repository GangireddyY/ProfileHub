<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { errorMessage, fieldErrors } from '@/api/http';
import UiInput from '@/components/ui/UiInput.vue';
import UiButton from '@/components/ui/UiButton.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const form = reactive({ email: '', password: '' });
const errors = ref({});
const formError = ref('');
const loading = ref(false);

async function submit() {
  errors.value = {};
  formError.value = '';
  if (!form.email) errors.value.email = 'Email is required';
  if (!form.password) errors.value.password = 'Password is required';
  if (Object.keys(errors.value).length) return;

  loading.value = true;
  try {
    await auth.login(form);
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/';
    router.replace(redirect);
  } catch (err) {
    errors.value = fieldErrors(err);
    formError.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}

function useDemo() {
  form.email = 'demo@profilehub.dev';
  form.password = 'password123';
  submit();
}
</script>

<template>
  <form class="stack" style="--gap: 18px" novalidate @submit.prevent="submit">
    <header class="stack" style="--gap: 6px">
      <h1 class="page-title">Welcome back</h1>
      <p class="muted">Sign in to see who's around and catch up with your network.</p>
    </header>

    <Transition name="fade">
      <p v-if="formError" class="form-alert" role="alert">{{ formError }}</p>
    </Transition>

    <UiInput
      v-model="form.email"
      label="Email"
      type="email"
      :icon="Mail"
      placeholder="you@example.com"
      autocomplete="email"
      inputmode="email"
      :error="errors.email"
    />
    <UiInput
      v-model="form.password"
      label="Password"
      type="password"
      :icon="Lock"
      placeholder="Your password"
      autocomplete="current-password"
      :error="errors.password"
    />

    <UiButton type="submit" size="lg" block :loading="loading" :icon-right="ArrowRight">Sign in</UiButton>

    <div class="divider"><span>or</span></div>

    <UiButton variant="secondary" block :icon="Sparkles" :disabled="loading" @click="useDemo">
      Try the demo account
    </UiButton>

    <p class="muted switch">
      New to ProfileHUB?
      <RouterLink :to="{ name: 'signup', query: route.query }" class="link">Create an account</RouterLink>
    </p>
  </form>
</template>

<style scoped>
.form-alert {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 0.9rem;
  font-weight: 500;
}
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-3);
  font-size: 0.8rem;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.switch {
  text-align: center;
  font-size: 0.92rem;
}
.link {
  color: var(--primary);
  font-weight: 700;
}
.link:hover {
  text-decoration: underline;
}
</style>
