<script setup>
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, Lock, User, Briefcase, ArrowRight, ArrowLeft, Check } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { errorMessage, fieldErrors } from '@/api/http';
import { toast } from '@/composables/useToast';
import { getProfession } from '@/constants/professions';
import UiInput from '@/components/ui/UiInput.vue';
import UiButton from '@/components/ui/UiButton.vue';
import ProfessionPicker from '@/components/ProfessionPicker.vue';

const auth = useAuthStore();
const router = useRouter();

const steps = ['Your account', 'Your profession'];
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
  <div class="stack" style="--gap: 20px">
    <ol class="stepper" :aria-label="`Step ${step} of ${steps.length}`">
      <li
        v-for="(label, i) in steps"
        :key="label"
        :class="{ 'is-current': step === i + 1, 'is-done': step > i + 1 }"
        :aria-current="step === i + 1 ? 'step' : undefined"
      >
        <span class="stepper__dot">
          <Check v-if="step > i + 1" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="stepper__label">{{ label }}</span>
      </li>
    </ol>

    <header class="auth-head">
      <h1 class="auth-title">{{ step === 1 ? 'Create your account' : 'What do you do?' }}</h1>
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

    <p class="switch">
      Already have an account? <RouterLink to="/login" class="link">Sign in</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.stepper {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.stepper li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.stepper li + li {
  flex: 1;
  gap: 10px;
}
.stepper li + li::before {
  content: '';
  flex: 1;
  min-width: 20px;
  height: 2px;
  border-radius: 2px;
  background: var(--border);
  transition: background-color 0.3s var(--ease);
}
.stepper li.is-done + li::before {
  background: linear-gradient(90deg, var(--primary), var(--accent));
}
.stepper__dot {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-3);
  background: var(--surface-3);
  transition: all 0.3s var(--ease);
}
.stepper__dot svg {
  width: 15px;
  height: 15px;
  stroke-width: 3;
}
.stepper li.is-current .stepper__dot,
.stepper li.is-done .stepper__dot {
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  box-shadow: 0 6px 14px -6px color-mix(in srgb, var(--primary) 80%, transparent);
}
.stepper li.is-current .stepper__dot {
  box-shadow: 0 0 0 4px var(--primary-soft), 0 6px 14px -6px color-mix(in srgb, var(--primary) 80%, transparent);
}
.stepper__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stepper li.is-current .stepper__label,
.stepper li.is-done .stepper__label {
  color: var(--text);
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
</style>
