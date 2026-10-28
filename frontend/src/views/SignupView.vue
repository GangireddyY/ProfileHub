<script setup>
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, Lock, User, ArrowRight, BriefcaseBusiness, Store, MessageCircle } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { errorMessage, fieldErrors } from '@/api/http';
import UiInput from '@/components/ui/UiInput.vue';
import UiButton from '@/components/ui/UiButton.vue';

const auth = useAuthStore();
const router = useRouter();

const form = reactive({ name: '', email: '', password: '' });
const errors = ref({});
const formError = ref('');
const loading = ref(false);

const PERKS = [
  { icon: BriefcaseBusiness, text: 'Get hired' },
  { icon: Store, text: 'Buy & sell' },
  { icon: MessageCircle, text: 'Chat live' },
];

const strength = computed(() => {
  const p = form.password;
  if (p.length < 8) return 0;
  let score = 1;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return score;
});
const strengthLabel = computed(() => ['Too short', 'Weak', 'Okay', 'Good', 'Strong'][strength.value]);

function validate() {
  const e = {};
  if (form.name.trim().length < 2) e.name = 'Enter your full name';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email address';
  if (form.password.length < 8) e.password = 'Use at least 8 characters';
  errors.value = e;
  return !Object.keys(e).length;
}

async function submit() {
  formError.value = '';
  if (!validate()) return;
  loading.value = true;
  try {
    await auth.signup({ name: form.name.trim(), email: form.email.trim(), password: form.password });
    router.replace({ name: 'welcome' });
  } catch (err) {
    errors.value = fieldErrors(err);
    formError.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form class="stack" style="--gap: 20px" novalidate @submit.prevent="submit">
    <header class="auth-head">
      <h1 class="auth-title">Create your account</h1>
      <p class="muted">It takes 30 seconds. You'll set up your profession and work details right after.</p>
    </header>

    <ul class="perks" aria-hidden="true">
      <li v-for="p in PERKS" :key="p.text"><component :is="p.icon" /> {{ p.text }}</li>
    </ul>

    <Transition name="fade">
      <p v-if="formError" class="form-alert" role="alert">{{ formError }}</p>
    </Transition>

    <div class="stack" style="--gap: 16px">
      <UiInput v-model="form.name" label="Full name" :icon="User" placeholder="Jane Doe" autocomplete="name" :error="errors.name" />
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
      <div class="stack" style="--gap: 8px">
        <UiInput
          v-model="form.password"
          label="Password"
          type="password"
          :icon="Lock"
          placeholder="At least 8 characters"
          autocomplete="new-password"
          :error="errors.password"
        />
        <div v-if="form.password" class="strength" :data-score="strength">
          <div class="strength__bars"><span v-for="i in 4" :key="i" :class="{ on: i <= strength }" /></div>
          <span>{{ strengthLabel }}</span>
        </div>
      </div>
    </div>

    <UiButton type="submit" size="lg" block :loading="loading" :icon-right="ArrowRight">Create account</UiButton>

    <p class="terms subtle">
      By creating an account you agree to our
      <RouterLink to="/terms" class="link" target="_blank">Terms &amp; community guidelines</RouterLink>
      and
      <RouterLink to="/privacy" class="link" target="_blank">Privacy policy</RouterLink>.
      Misusing other members' profiles or contact details can get your account removed.
    </p>

    <p class="switch">
      Already have an account? <RouterLink to="/login" class="link">Sign in</RouterLink>
    </p>
  </form>
</template>

<style scoped>
.perks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.perks li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: 99px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 0.8rem;
  font-weight: 700;
}
.perks svg {
  width: 15px;
  height: 15px;
}
.strength {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-2);
}
.strength__bars {
  display: flex;
  gap: 4px;
  flex: 1;
}
.strength__bars span {
  flex: 1;
  height: 4px;
  border-radius: 4px;
  background: var(--surface-3);
  transition: background-color 0.2s;
}
.strength[data-score='1'] .on {
  background: var(--danger);
}
.strength[data-score='2'] .on {
  background: var(--warning);
}
.strength[data-score='3'] .on,
.strength[data-score='4'] .on {
  background: var(--success);
}
.terms {
  margin-top: -8px;
  text-align: center;
  font-size: 0.78rem;
}
</style>
