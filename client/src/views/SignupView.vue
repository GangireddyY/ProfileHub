<script setup>
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, Lock, User, Briefcase, ArrowRight, ArrowLeft } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { errorMessage, fieldErrors } from '@/api/http';
import { toast } from '@/composables/useToast';
import { getProfession } from '@/constants/professions';
import UiInput from '@/components/ui/UiInput.vue';
import UiButton from '@/components/ui/UiButton.vue';
import ProfessionPicker from '@/components/ProfessionPicker.vue';

const auth = useAuthStore();
const router = useRouter();

const step = ref(1);
const form = reactive({ name: '', email: '', password: '', profession: '', roleTitle: '' });
const errors = ref({});
const formError = ref('');
const loading = ref(false);

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

const rolePlaceholder = computed(() => {
  const examples = {
    software: 'e.g. Senior Backend Engineer',
    doctor: 'e.g. Cardiologist',
    teacher: 'e.g. Physics Teacher',
    designer: 'e.g. Product Designer',
  };
  return examples[form.profession] || `e.g. ${getProfession(form.profession).label} professional`;
});

function validateStep1() {
  const e = {};
  if (form.name.trim().length < 2) e.name = 'Enter your full name';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email address';
  if (form.password.length < 8) e.password = 'Use at least 8 characters';
  errors.value = e;
  return !Object.keys(e).length;
}

function next() {
  if (validateStep1()) step.value = 2;
}

async function submit() {
  if (!form.profession) {
    errors.value = { profession: 'Pick the field you work in' };
    return;
  }
  loading.value = true;
  formError.value = '';
  try {
    await auth.signup({ ...form, name: form.name.trim(), email: form.email.trim() });
    toast.success('Turn on location in Discover to find people near you.', { title: `Welcome, ${form.name.split(' ')[0]}!` });
    router.replace('/');
  } catch (err) {
    const fields = fieldErrors(err);
    errors.value = fields;
    formError.value = errorMessage(err);
    if (fields.name || fields.email || fields.password || err.response?.status === 409) step.value = 1;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="stack" style="--gap: 18px">
    <header class="stack" style="--gap: 6px">
      <div class="steps" aria-hidden="true">
        <span :class="{ 'is-on': step >= 1 }" />
        <span :class="{ 'is-on': step >= 2 }" />
      </div>
      <p class="subtle step-label">Step {{ step }} of 2</p>
      <h1 class="page-title">{{ step === 1 ? 'Create your account' : 'What do you do?' }}</h1>
      <p class="muted">
        {{ step === 1 ? 'Join professionals building their network nearby.' : 'This sets your profession badge so others can find you.' }}
      </p>
    </header>

    <Transition name="fade">
      <p v-if="formError" class="form-alert" role="alert">{{ formError }}</p>
    </Transition>

    <Transition name="page" mode="out-in">
      <form v-if="step === 1" key="s1" class="stack" style="--gap: 16px" novalidate @submit.prevent="next">
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
        <UiButton type="submit" size="lg" block :icon-right="ArrowRight">Continue</UiButton>
      </form>

      <form v-else key="s2" class="stack" style="--gap: 18px" novalidate @submit.prevent="submit">
        <ProfessionPicker v-model="form.profession" label="Profession" :error="errors.profession" />
        <UiInput
          v-model="form.roleTitle"
          label="Role or title (optional)"
          :icon="Briefcase"
          :placeholder="rolePlaceholder"
          maxlength="100"
          :error="errors.roleTitle"
        />
        <div class="row">
          <UiButton variant="secondary" size="lg" :icon="ArrowLeft" icon-only aria-label="Back" @click="step = 1" />
          <UiButton type="submit" size="lg" class="grow" :loading="loading">Create account</UiButton>
        </div>
      </form>
    </Transition>

    <p class="muted switch">
      Already have an account? <RouterLink to="/login" class="link">Sign in</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.steps {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}
.steps span {
  height: 5px;
  flex: 1;
  border-radius: 99px;
  background: var(--surface-3);
  transition: background-color 0.3s var(--ease);
}
.steps span.is-on {
  background: linear-gradient(90deg, var(--primary), var(--accent));
}
.step-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.form-alert {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 0.9rem;
  font-weight: 500;
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
.switch {
  text-align: center;
  font-size: 0.92rem;
}
.link {
  color: var(--primary);
  font-weight: 700;
}
</style>
