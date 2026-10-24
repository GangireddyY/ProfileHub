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
  <form class="stack" style="--gap: 20px" novalidate @submit.prevent="submit">
    <header class="auth-head">
      <h1 class="auth-title">Welcome back</h1>
      <p class="muted">Sign in to see who's around and catch up with your network.</p>
    </header>

    <Transition name="fade">
      <p v-if="formError" class="form-alert" role="alert">{{ formError }}</p>
    </Transition>

    <div class="stack" style="--gap: 16px">
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
    </div>

    <UiButton type="submit" size="lg" block :loading="loading" :icon-right="ArrowRight">Sign in</UiButton>

    <div class="divider"><span>or</span></div>

    <div class="demo">
      <span class="demo__icon"><Sparkles /></span>
      <div class="grow">
        <strong>Just exploring?</strong>
        <p>Jump in with a ready-made demo profile.</p>
      </div>
      <UiButton variant="soft" size="sm" :disabled="loading" @click="useDemo">Try demo</UiButton>
    </div>

    <p class="switch">
      New to ProfileHUB?
      <RouterLink :to="{ name: 'signup', query: route.query }" class="link">Create an account</RouterLink>
    </p>
  </form>
</template>

<style scoped>
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-3);
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.demo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px dashed color-mix(in srgb, var(--primary) 40%, var(--border));
  background: color-mix(in srgb, var(--primary) 5%, transparent);
}
.demo strong {
  font-size: 0.92rem;
}
.demo p {
  font-size: 0.82rem;
  color: var(--text-2);
}
.demo__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  box-shadow: 0 8px 18px -8px color-mix(in srgb, var(--primary) 80%, transparent);
}
.demo__icon svg {
  width: 20px;
  height: 20px;
}
</style>
