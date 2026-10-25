<script setup>
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  Check,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Wallet,
  Camera,
  MapPin,
  Hourglass,
  Sparkles,
  PartyPopper,
  Award,
} from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/composables/useToast';
import { getProfession, RATE_UNITS, CURRENCIES } from '@/constants/professions';
import { formatRate } from '@/utils/format';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiToggle from '@/components/ui/UiToggle.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import ProfessionPicker from '@/components/ProfessionPicker.vue';
import ProfessionBadge from '@/components/ProfessionBadge.vue';
import AvatarUploader from '@/components/profile/AvatarUploader.vue';
import { markOnboarded } from '@/utils/onboarding';

const auth = useAuthStore();
const router = useRouter();
const me = computed(() => auth.user);

const STEPS = [
  { title: 'Profession', text: 'What you do', icon: BriefcaseBusiness },
  { title: 'Work details', text: 'Role, rate & availability', icon: Wallet },
  { title: 'Photo & bio', text: 'Help people trust you', icon: Camera },
];
const step = ref(1);
const saving = ref(false);
const errors = ref({});
const requested = ref(null);

const form = reactive({
  profession: me.value.profession === 'other' ? '' : me.value.profession,
  roleTitle: me.value.roleTitle || '',
  city: me.value.city || '',
  experienceYears: me.value.experienceYears || '',
  // Brand-new members start "available"; anyone revisiting keeps their saved choice.
  availableForWork: me.value.profession === 'other' && !me.value.roleTitle ? true : me.value.availableForWork,
  rateAmount: me.value.rateAmount ?? '',
  rateUnit: me.value.rateUnit || 'hour',
  currency: me.value.currency || 'INR',
  headline: me.value.headline || '',
  bio: me.value.bio || '',
});
const unitOptions = RATE_UNITS.map((u) => ({ value: u.value, label: u.label }));

const profession = computed(() => getProfession(form.profession || 'other'));
const preview = computed(() => ({
  ...me.value,
  ...form,
  rateAmount: form.rateAmount === '' ? null : Number(form.rateAmount),
}));
const previewRate = computed(() => formatRate(preview.value));
const firstName = computed(() => me.value.name.split(' ')[0]);
const progress = computed(() => Math.round(((step.value - 1) / STEPS.length) * 100));

async function requestProfession(payload) {
  const { data } = await api.post('/professions/requests', payload);
  requested.value = data.request;
  form.profession = '';
  toast.success(`We'll notify you when an admin adds “${payload.label}”.`, { title: 'Request sent' });
}

function finishLater() {
  markOnboarded(me.value);
  router.replace('/');
}

const payloadFor = (n) => {
  if (n === 1) return { profession: form.profession || 'other' };
  if (n === 2) {
    return {
      roleTitle: form.roleTitle.trim(),
      ...(!me.value.headline && form.roleTitle.trim() ? { headline: form.roleTitle.trim() } : {}),
      city: form.city.trim(),
      experienceYears: Number(form.experienceYears) || 0,
      availableForWork: form.availableForWork,
      rateAmount: form.rateAmount === '' || form.rateAmount == null ? null : Number(form.rateAmount),
      rateUnit: form.rateUnit,
      currency: form.currency,
    };
  }
  return { ...(form.headline.trim() ? { headline: form.headline.trim() } : {}), bio: form.bio.trim() };
};

async function next() {
  errors.value = {};
  if (step.value === 1 && !form.profession && !requested.value) {
    errors.value.profession = 'Pick your profession, or request it if it is missing';
    return;
  }
  saving.value = true;
  try {
    await auth.updateProfile(payloadFor(step.value));
    if (step.value === 2 && !form.headline) form.headline = me.value.headline || '';
    if (step.value < STEPS.length) {
      step.value++;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      markOnboarded(me.value);
      toast.success('Your profile is ready. People nearby can now find you.', { title: `You're all set, ${firstName.value}!` });
      router.replace('/');
    }
  } catch (err) {
    errors.value = fieldErrors(err);
    toast.error(errorMessage(err));
  } finally {
    saving.value = false;
  }
}

function goTo(n) {
  if (n < step.value) step.value = n;
}
</script>

<template>
  <div class="ob">
    <div class="ob__glow" aria-hidden="true" />

    <header class="ob__top">
      <span class="brand">
        <img src="/favicon.svg" alt="" width="34" height="34" />
        <span>ProfileHUB</span>
      </span>
      <span class="ob__count">Step {{ step }} of {{ STEPS.length }}</span>
      <button type="button" class="ob__skip" @click="finishLater">Skip for now</button>
    </header>
    <div class="ob__bar" aria-hidden="true"><span :style="{ width: `${Math.max(progress, 6)}%` }" /></div>

    <div class="ob__wrap">
      <aside class="ob__side">
        <div class="hello">
          <PartyPopper />
          <div>
            <strong>Welcome, {{ firstName }}!</strong>
            <p class="muted">Three quick steps to a profile people trust.</p>
          </div>
        </div>

        <ol class="steps">
          <li
            v-for="(s, i) in STEPS"
            :key="s.title"
            :class="{ 'is-current': step === i + 1, 'is-done': step > i + 1 }"
            @click="goTo(i + 1)"
          >
            <span class="steps__dot">
              <Check v-if="step > i + 1" />
              <component :is="s.icon" v-else />
            </span>
            <span class="steps__text">
              <strong>{{ s.title }}</strong>
              <small>{{ s.text }}</small>
            </span>
          </li>
        </ol>

        <div class="preview" :style="{ '--hue': profession.hue }">
          <span class="preview__label">Live preview</span>
          <div class="card">
            <div class="card__cover">
              <span v-if="preview.availableForWork" class="card__available">Available</span>
            </div>
            <div class="card__body">
              <UiAvatar :name="me.name" :src="me.avatarUrl" :size="68" ring class="card__avatar" />
              <strong class="card__name">{{ me.name }}</strong>
              <span class="card__role">{{ preview.roleTitle || (form.profession ? profession.label : 'Your role') }}</span>
              <ProfessionBadge :profession="form.profession || 'other'" size="sm" />
              <div class="card__meta">
                <span v-if="preview.city"><MapPin /> {{ preview.city }}</span>
                <span v-if="preview.experienceYears"><Award /> {{ preview.experienceYears }}+ yrs</span>
              </div>
              <span v-if="previewRate" class="card__rate">{{ previewRate }}</span>
            </div>
          </div>
        </div>
      </aside>

      <main class="ob__main">
        <Transition name="page" mode="out-in">
          <section v-if="step === 1" key="1" class="panel">
            <header class="panel__head">
              <span class="panel__kicker">Step 1 · Profession</span>
              <h1>What do you do, {{ firstName }}?</h1>
              <p class="muted">Your profession puts you in front of the right people, from clients to employers.</p>
            </header>
            <ProfessionPicker v-model="form.profession" :error="errors.profession" :request-handler="requestProfession" />
            <div v-if="requested" class="note">
              <Hourglass />
              <p>
                <strong>“{{ requested.label }}”</strong> was sent to an admin for review. You'll get a notification once
                it's added. You can still pick something close in the meantime.
              </p>
            </div>
          </section>

          <section v-else-if="step === 2" key="2" class="panel">
            <header class="panel__head">
              <span class="panel__kicker">Step 2 · Work details</span>
              <h1>Tell people about your work</h1>
              <p class="muted">Everything here is optional, and you can change it any time in Settings.</p>
            </header>

            <div class="form-grid form-grid--2">
              <UiInput
                v-model="form.roleTitle"
                label="Role or title"
                :placeholder="`e.g. ${form.profession ? profession.label : 'Senior Electrician'}`"
                maxlength="100"
                :error="errors.roleTitle"
              />
              <UiInput v-model="form.city" label="City / area" :icon="MapPin" placeholder="e.g. Bengaluru" maxlength="100" :error="errors.city" />
              <UiInput
                v-model="form.experienceYears"
                label="Years of experience"
                type="number"
                min="0"
                max="70"
                inputmode="numeric"
                placeholder="e.g. 5"
                :error="errors.experienceYears"
              />
            </div>

            <div class="box">
              <UiToggle
                v-model="form.availableForWork"
                :icon="Sparkles"
                label="I'm available for work"
                description="Shows an “Available” badge and includes you in the hiring filter."
              />
              <div class="rate">
                <span class="field__label">Your rate <span class="subtle">(optional)</span></span>
                <div class="rate__row">
                  <UiSelect v-model="form.currency" :options="CURRENCIES" aria-label="Currency" />
                  <UiInput
                    v-model="form.rateAmount"
                    type="number"
                    min="1"
                    inputmode="numeric"
                    placeholder="e.g. 500"
                    aria-label="Rate amount"
                    :error="errors.rateAmount"
                  />
                  <UiSelect v-model="form.rateUnit" :options="unitOptions" aria-label="Rate unit" />
                </div>
              </div>
            </div>
          </section>

          <section v-else key="3" class="panel">
            <header class="panel__head">
              <span class="panel__kicker">Step 3 · Photo &amp; bio</span>
              <h1>Put a face to your name</h1>
              <p class="muted">Profiles with a photo and a short bio get far more replies.</p>
            </header>
            <div class="box">
              <AvatarUploader />
            </div>
            <UiInput v-model="form.headline" label="Headline" maxlength="160" placeholder="e.g. Reliable electrician, 10 years in residential wiring" :error="errors.headline" />
            <UiTextarea
              v-model="form.bio"
              label="About you"
              :maxlength="2000"
              :rows="4"
              placeholder="What you do, where you work, and what kind of jobs or connections you're looking for."
              :error="errors.bio"
            />
          </section>
        </Transition>

        <footer class="ob__actions">
          <UiButton v-if="step > 1" variant="secondary" size="lg" :icon="ArrowLeft" @click="step--">Back</UiButton>
          <span class="grow" />
          <UiButton size="lg" :loading="saving" :icon-right="step < STEPS.length ? ArrowRight : Check" @click="next">
            {{ step < STEPS.length ? 'Continue' : 'Finish setup' }}
          </UiButton>
        </footer>
      </main>
    </div>
  </div>
</template>

<style scoped>
.ob {
  position: relative;
  min-height: 100dvh;
  isolation: isolate;
}
.ob__glow {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(700px 420px at 90% -10%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 70%),
    radial-gradient(600px 380px at -5% 110%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%);
}

.ob__top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 64px;
  padding: 0 var(--page-pad);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  backdrop-filter: saturate(180%) blur(14px);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 1.1rem;
}
.brand img {
  border-radius: 10px;
}
.ob__count {
  margin-left: auto;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-3);
}
.ob__skip {
  height: 36px;
  padding: 0 14px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.86rem;
}
.ob__skip:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
.ob__bar {
  position: sticky;
  top: 64px;
  z-index: 10;
  height: 3px;
  background: var(--border);
}
.ob__bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  border-radius: 0 3px 3px 0;
  transition: width 0.4s var(--ease);
}

.ob__wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 28px;
  max-width: 1120px;
  margin: 0 auto;
  padding: 28px var(--page-pad) 40px;
}
.ob__side {
  display: none;
}
.hello {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.hello > svg {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  color: var(--warning);
}
.hello p {
  font-size: 0.86rem;
}
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.steps li {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 14px;
  color: var(--text-3);
}
.steps li + li::before {
  content: '';
  position: absolute;
  left: 27px;
  top: -10px;
  width: 2px;
  height: 16px;
  background: var(--border);
}
.steps li.is-done::before,
.steps li.is-current::before {
  background: var(--primary);
}
.steps li.is-done {
  cursor: pointer;
}
.steps li.is-current {
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  color: var(--text);
}
.steps__dot {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 11px;
  background: var(--surface-3);
}
.steps__dot svg {
  width: 18px;
  height: 18px;
}
.steps li.is-current .steps__dot,
.steps li.is-done .steps__dot {
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
}
.steps__text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.steps__text strong {
  font-size: 0.92rem;
}
.steps__text small {
  font-size: 0.78rem;
  color: var(--text-3);
}
.steps li.is-done .steps__text strong {
  color: var(--text-2);
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.preview__label {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-3);
}
.card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.card__cover {
  position: relative;
  height: 64px;
  background: radial-gradient(120% 140% at 0% 0%, hsl(var(--hue) 85% 72%), transparent 60%),
    linear-gradient(135deg, hsl(var(--hue) 75% 58%), hsl(calc(var(--hue) + 35) 70% 55%));
  transition: background 0.4s var(--ease);
}
.card__available {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 3px 9px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.92);
  color: #047857;
  font-size: 0.7rem;
  font-weight: 800;
}
.card__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 0 16px 18px;
  text-align: center;
}
.card__avatar {
  margin-top: -34px;
  margin-bottom: 4px;
}
.card__name {
  font-size: 1.02rem;
}
.card__role {
  font-size: 0.86rem;
  color: var(--text-2);
}
.card__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 12px;
  font-size: 0.78rem;
  color: var(--text-3);
}
.card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.card__meta svg {
  width: 13px;
  height: 13px;
}
.card__rate {
  margin-top: 2px;
  padding: 3px 10px;
  border-radius: 99px;
  background: var(--success-soft);
  color: var(--success);
  font-size: 0.82rem;
  font-weight: 800;
}

.ob__main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: clamp(20px, 4vw, 32px);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow);
}
.panel__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel__kicker {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--primary);
}
.panel__head h1 {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}
.box {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.box :deep(.field__input) {
  background: var(--surface);
}
.rate {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rate__row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 170px;
  gap: 8px;
  align-items: start;
}
.note {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--warning-soft);
  font-size: 0.88rem;
  color: var(--text-2);
}
.note svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--warning);
}
.ob__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 559px) {
  .rate__row {
    grid-template-columns: 1fr 1fr;
  }
  .rate__row > :nth-child(2) {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .ob__count {
    display: none;
  }
  .ob__skip {
    margin-left: auto;
  }
  .ob__actions {
    position: sticky;
    bottom: 0;
    padding: 12px 0 calc(12px + var(--safe-bottom));
    background: linear-gradient(to top, var(--bg) 70%, transparent);
  }
}

@media (min-width: 960px) {
  .ob__wrap {
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 36px;
    padding-top: 40px;
  }
  .ob__side {
    display: flex;
    flex-direction: column;
    gap: 24px;
    position: sticky;
    top: 100px;
    align-self: start;
  }
}
</style>
