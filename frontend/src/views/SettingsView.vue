<script setup>
import { reactive, ref, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  UserRound,
  MapPin,
  ShieldCheck,
  Palette,
  LogOut,
  LocateFixed,
  Eye,
  Wifi,
  Sun,
  Moon,
  Monitor,
  Save,
  Mail,
  KeyRound,
  Trash2,
  TriangleAlert,
  BriefcaseBusiness,
  Hourglass,
  CircleCheck,
  CircleX,
  ShieldHalf,
  ChevronRight,
  Contact,
  Phone,
  Pencil,
  House,
  Crown,
  MonitorSmartphone,
  Award,
  BadgeIndianRupee,
  BellRing,
  MailWarning,
  Languages,
  Star,
} from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import NotificationPrefs from '@/components/settings/NotificationPrefs.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useProfessionsStore } from '@/stores/professions';
import { useGeolocation } from '@/composables/useGeolocation';
import { toast } from '@/composables/useToast';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { DISTANCE_STEPS, stepForRadius } from '@/constants/filters';
import { RATE_UNITS, CURRENCIES } from '@/constants/professions';
import UiSelect from '@/components/ui/UiSelect.vue';
import { formatRate } from '@/utils/format';
import ProfessionBadge from '@/components/ProfessionBadge.vue';
import LocationCard from '@/components/LocationCard.vue';
import AccountSafety from '@/components/settings/AccountSafety.vue';
import { formatPlanPrice, formatDate } from '@/constants/plans';
import UiCard from '@/components/ui/UiCard.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiTagInput from '@/components/ui/UiTagInput.vue';
import UiToggle from '@/components/ui/UiToggle.vue';
import UiRange from '@/components/ui/UiRange.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import ProfessionPicker from '@/components/ProfessionPicker.vue';
import AvatarUploader from '@/components/profile/AvatarUploader.vue';
import BackButton from '@/components/BackButton.vue';

const auth = useAuthStore();
const theme = useThemeStore();
const geo = useGeolocation();
const router = useRouter();
const route = useRoute();
const me = computed(() => auth.user);

const professions = useProfessionsStore();

const { t } = useI18n();
/** Admins run the app; hiring, location and visibility settings only matter to members. */
const isAdmin = computed(() => me.value?.role === 'admin');
const MEMBER_SECTIONS = ['work', 'location', 'privacy'];
const sections = computed(() =>
  [
    { id: 'profile', icon: UserRound },
    { id: 'work', icon: BriefcaseBusiness },
    { id: 'contact', icon: Contact },
    { id: 'location', icon: MapPin },
    { id: 'notifications', icon: BellRing },
    { id: 'security', icon: KeyRound },
    { id: 'sessions', icon: MonitorSmartphone },
    { id: 'privacy', icon: ShieldCheck },
    { id: 'appearance', icon: Palette },
  ]
    .filter((s) => !isAdmin.value || !MEMBER_SECTIONS.includes(s.id))
    .map((s) => ({ ...s, label: t(`settings.sections.${s.id}`) })),
);

// ---------- Email verification ----------
const verifySending = ref(false);
async function sendVerification() {
  verifySending.value = true;
  try {
    const data = await auth.resendVerification();
    if (data.alreadyVerified) await auth.fetchMe();
    toast.success(data.message || t('auth.checkInbox'));
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    verifySending.value = false;
  }
}

// ---------- Profile ----------
const pickProfile = (u) => ({
  name: u.name,
  headline: u.headline,
  profession: u.profession,
  roleTitle: u.roleTitle,
  bio: u.bio,
  skills: [...(u.skills || [])],
  experienceYears: u.experienceYears,
  city: u.city,
  rateAmount: u.rateAmount ?? '',
  rateUnit: u.rateUnit || 'hour',
  currency: u.currency || 'INR',
  availableForWork: Boolean(u.availableForWork),
  contactEmail: u.contactEmail || '',
  phone: u.phone || '',
  address: u.address || '',
});
const form = reactive(pickProfile(me.value));
const errors = ref({});
const saving = ref(false);
const dirty = computed(() => JSON.stringify(form) !== JSON.stringify(pickProfile(me.value)));
const unitOptions = RATE_UNITS.map((u) => ({ value: u.value, label: u.label }));

async function saveProfile() {
  saving.value = true;
  errors.value = {};
  try {
    await auth.updateProfile({
      ...form,
      experienceYears: Number(form.experienceYears) || 0,
      rateAmount: form.rateAmount === '' || form.rateAmount == null ? null : Number(form.rateAmount),
    });
    Object.assign(form, pickProfile(me.value));
    editing.value = false;
    toast.success(t('settings.saved'));
  } catch (err) {
    errors.value = fieldErrors(err);
    toast.error(errorMessage(err));
  } finally {
    saving.value = false;
  }
}

function resetProfile() {
  Object.assign(form, pickProfile(me.value));
  errors.value = {};
}

/** The profile shows as read-only details until the user chooses to edit it. */
const FORM_SECTIONS = ['work', 'contact'];
const editing = ref(FORM_SECTIONS.includes(route.hash.slice(1)));

function startEdit() {
  resetProfile();
  editing.value = true;
}
function cancelEdit() {
  resetProfile();
  editing.value = false;
}

const summary = computed(() => {
  const u = me.value;
  const s = (key, params) => t(`settings.summary.${key}`, params);
  const adminHidden = new Set([s('experience'), s('rate'), s('availability'), s('rating'), s('plan')]);
  return [
    { label: s('city'), value: u.city, icon: MapPin },
    { label: s('experience'), value: u.experienceYears ? s('years', { n: u.experienceYears }) : s('gettingStarted'), icon: Award },
    { label: s('rate'), value: formatRate(u) || t('common.notSet'), icon: BadgeIndianRupee },
    { label: s('availability'), value: u.availableForWork ? s('available') : s('notLooking'), icon: BriefcaseBusiness },
    {
      label: s('rating'),
      value: u.rating?.count ? t('reviews.summary', { avg: u.rating.average, n: u.rating.count }, u.rating.count) : t('card.noReviews'),
      icon: Star,
    },
    { label: s('email'), value: u.contactEmail, icon: Mail, href: u.contactEmail && `mailto:${u.contactEmail}` },
    { label: s('mobile'), value: u.phone, icon: Phone, href: u.phone && `tel:${u.phone.replace(/[\s-]/g, '')}` },
    {
      label: s('plan'),
      value: u.plan
        ? `${u.plan.name} · ${formatPlanPrice(u.plan)}${u.planExpiresAt ? ` · ${s('until', { date: formatDate(u.planExpiresAt) })}` : ''}`
        : s('freeMember'),
      icon: Crown,
      to: '/plans',
    },
    { label: s('address'), value: u.address, icon: House, wide: true },
  ].filter((row) => !isAdmin.value || !adminHidden.has(row.label));
});

// ---------- Profession requests ----------
const myRequests = ref([]);
const REQUEST_STATUS = {
  pending: { icon: Hourglass, label: 'Waiting for review', tone: 'warning' },
  approved: { icon: CircleCheck, label: 'Added', tone: 'success' },
  rejected: { icon: CircleX, label: 'Declined', tone: 'danger' },
};

async function loadRequests() {
  try {
    const { data } = await api.get('/professions/requests/mine');
    myRequests.value = data.items;
  } catch {
    /* non-critical */
  }
}
loadRequests();

async function requestProfession(payload) {
  await api.post('/professions/requests', payload);
  toast.success(`We'll notify you when an admin reviews “${payload.label}”.`, { title: 'Request sent' });
  loadRequests();
}

// ---------- Settings toggles ----------
const pending = reactive({});

async function setSetting(key, value, message) {
  pending[key] = true;
  try {
    await auth.updateSettings({ [key]: value });
    if (message) toast.success(message);
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    pending[key] = false;
  }
}

const shareLocation = computed({
  get: () => me.value.hasLocation,
  set: async (on) => {
    pending.location = true;
    try {
      if (on) {
        if (await geo.locate()) toast.success(t('settings.locationOn'));
        else toast.error(geo.error.value);
      } else {
        await auth.clearLocation();
        toast.success(t('settings.locationOff'));
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      pending.location = false;
    }
  },
});

const showOnline = computed({
  get: () => me.value.showOnlineStatus,
  set: (v) => setSetting('showOnlineStatus', v, v ? t('settings.onlineVisible') : t('settings.onlineHidden')),
});

const discoverable = computed({
  get: () => me.value.discoverable,
  set: (v) => setSetting('discoverable', v, v ? t('settings.discoverOn') : t('settings.discoverOff')),
});

const RADIUS_STEPS = DISTANCE_STEPS.filter((s) => s != null);
const radiusIdx = ref(Math.min(stepForRadius(me.value.discoveryRadiusKm), RADIUS_STEPS.length - 1));
let radiusTimer;
watch(radiusIdx, (i) => {
  clearTimeout(radiusTimer);
  radiusTimer = setTimeout(() => setSetting('discoveryRadiusKm', RADIUS_STEPS[i]), 500);
});

const themeOptions = computed(() => [
  { value: 'light', label: t('settings.theme.light'), icon: Sun },
  { value: 'dark', label: t('settings.theme.dark'), icon: Moon },
  { value: 'system', label: t('settings.theme.system'), icon: Monitor },
]);

async function scrollTo(id) {
  if (FORM_SECTIONS.includes(id) && !editing.value) {
    startEdit();
    await nextTick();
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}

// ---------- Security ----------
const pw = reactive({ currentPassword: '', newPassword: '', confirm: '' });
const pwErrors = ref({});
const pwSaving = ref(false);

async function changePassword() {
  pwErrors.value = {};
  if (pw.newPassword.length < 8) pwErrors.value.newPassword = t('auth.min8');
  if (pw.newPassword !== pw.confirm) pwErrors.value.confirm = t('auth.mismatch');
  if (Object.keys(pwErrors.value).length) return;

  pwSaving.value = true;
  try {
    const signedOut = await auth.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
    Object.assign(pw, { currentPassword: '', newPassword: '', confirm: '' });
    toast.success(signedOut ? t('settings.passwordUpdatedOthers', { n: signedOut }, signedOut) : t('settings.passwordUpdated'));
  } catch (err) {
    pwErrors.value = fieldErrors(err);
    if (!Object.keys(pwErrors.value).length) toast.error(errorMessage(err));
  } finally {
    pwSaving.value = false;
  }
}

// ---------- Delete account ----------
const deleteOpen = ref(false);
const deletePassword = ref('');
const deleteError = ref('');
const deleting = ref(false);

function openDelete() {
  deletePassword.value = '';
  deleteError.value = '';
  deleteOpen.value = true;
}

async function deleteAccount() {
  deleting.value = true;
  deleteError.value = '';
  try {
    await auth.deleteAccount(deletePassword.value);
    deleteOpen.value = false;
    toast.info(t('settings.deleted'));
    router.replace({ name: 'signup' });
  } catch (err) {
    deleteError.value = errorMessage(err);
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="container page-layout">
    <aside class="page-aside page-aside--sticky settings__nav">
      <UiCard :padded="false">
        <header class="nav-head">
          <UiAvatar :name="me.name" :src="me.avatarUrl" :size="44" />
          <div class="grow" style="min-width: 0">
            <strong class="truncate" style="display: block">{{ me.name }}</strong>
            <span class="muted truncate" style="display: block; font-size: 0.82rem">{{ me.email }}</span>
          </div>
        </header>
        <nav class="nav-list" :aria-label="t('settings.sectionsLabel')">
          <button v-for="s in sections" :key="s.id" type="button" class="nav-link" @click="scrollTo(s.id)">
            <component :is="s.icon" /> {{ s.label }}
          </button>
        </nav>
      </UiCard>
    </aside>

    <div class="page-main">
      <BackButton />
      <header class="page-head">
        <div>
          <h1 class="page-title">{{ t('settings.title') }}</h1>
          <p class="muted">{{ t('settings.lead') }}</p>
        </div>
      </header>

      <div v-if="!me.emailVerifiedAt" class="verify-banner" role="status">
        <span class="verify-banner__icon"><MailWarning /></span>
        <div class="grow" style="min-width: 0">
          <strong>{{ t('settings.emailUnverified') }}</strong>
          <p class="muted">{{ t('settings.emailUnverifiedText', { email: me.email }) }}</p>
        </div>
        <UiButton size="sm" :loading="verifySending" @click="sendVerification">{{ t('settings.sendConfirmation') }}</UiButton>
      </div>

      <div class="settings__grid">
        <!-- Profile -->
        <UiCard id="profile" class="section section--full">
          <header class="section__head">
            <span class="section__icon"><UserRound /></span>
            <div>
              <h2 class="section-title">{{ t('settings.sections.profile') }}</h2>
              <p class="muted">
                {{ editing ? t('settings.profileEditing') : t('settings.profileViewing') }}
              </p>
            </div>
          </header>

          <div v-if="!editing" class="summary">
            <div class="summary__top">
              <UiAvatar :name="me.name" :src="me.avatarUrl" :size="72" />
              <div class="summary__who">
                <strong class="summary__name">{{ me.name }}</strong>
                <span class="muted">{{ me.roleTitle || t('settings.addRole') }}</span>
                <p v-if="me.headline" class="summary__headline">{{ me.headline }}</p>
                <ProfessionBadge :profession="me.profession" size="sm" />
              </div>
              <div class="summary__actions">
                <UiButton variant="secondary" size="sm" :icon="Eye" :to="`/u/${me.id}`">{{ t('settings.viewPublic') }}</UiButton>
                <UiButton size="sm" :icon="Pencil" @click="startEdit">{{ t('settings.editProfile') }}</UiButton>
              </div>
            </div>

            <dl class="summary__grid">
              <div v-for="row in summary" :key="row.label" :class="{ 'summary__item--wide': row.wide }">
                <span class="summary__icon"><component :is="row.icon" /></span>
                <div class="summary__text">
                  <dt>{{ row.label }}</dt>
                  <dd v-if="row.to">
                    {{ row.value }} · <RouterLink :to="row.to" class="summary__link">{{ t('common.viewPlans') }}</RouterLink>
                  </dd>
                  <dd v-else-if="row.value && row.href"><a :href="row.href">{{ row.value }}</a></dd>
                  <dd v-else-if="row.value">{{ row.value }}</dd>
                  <dd v-else class="summary__empty">{{ t('common.notAdded') }}</dd>
                </div>
              </div>
            </dl>

            <div class="summary__block">
              <h3 class="summary__label">{{ t('settings.about') }}</h3>
              <p v-if="me.bio" class="summary__bio">{{ me.bio }}</p>
              <p v-else class="summary__empty">{{ t('settings.aboutEmpty') }}</p>
            </div>
            <div class="summary__block">
              <h3 class="summary__label">{{ t('settings.skills') }}</h3>
              <div v-if="me.skills?.length" class="summary__skills">
                <span v-for="s in me.skills" :key="s" class="summary__skill">{{ s }}</span>
              </div>
              <p v-else class="summary__empty">{{ t('settings.skillsEmpty') }}</p>
            </div>
          </div>

          <form v-else class="stack" style="--gap: 18px" novalidate @submit.prevent="saveProfile">
            <AvatarUploader />

            <div class="form-grid form-grid--2">
              <UiInput v-model="form.name" :label="t('settings.form.fullName')" maxlength="80" :error="errors.name" autocomplete="name" />
              <UiInput
                v-model="form.roleTitle"
                :label="t('settings.form.roleTitle')"
                maxlength="100"
                :placeholder="t('settings.form.roleTitlePh')"
                :error="errors.roleTitle"
              />
              <UiInput
                v-model="form.headline"
                class="span-2"
                :label="t('settings.form.headline')"
                maxlength="160"
                :placeholder="t('settings.form.headlinePh')"
                :error="errors.headline"
              />
              <UiInput v-model="form.city" :label="t('settings.form.city')" maxlength="100" :placeholder="t('settings.form.cityPh')" :error="errors.city" />
              <UiInput
                v-model.number="form.experienceYears"
                :label="t('settings.form.years')"
                type="number"
                min="0"
                max="70"
                inputmode="numeric"
                :error="errors.experienceYears"
              />
            </div>

            <ProfessionPicker
              v-model="form.profession"
              :label="t('settings.form.profession')"
              :error="errors.profession"
              :request-handler="requestProfession"
            />
            <ul v-if="myRequests.length" class="requests" aria-label="Your profession requests">
              <li v-for="r in myRequests" :key="r.id" :class="`requests__item--${REQUEST_STATUS[r.status].tone}`">
                <component :is="REQUEST_STATUS[r.status].icon" class="requests__icon" />
                <div class="grow" style="min-width: 0">
                  <strong>{{ r.label }}</strong>
                  <span class="muted"> · {{ professions.category(r.category).label }}</span>
                  <p v-if="r.reviewNote" class="requests__note">“{{ r.reviewNote }}”</p>
                </div>
                <span class="requests__status">{{ REQUEST_STATUS[r.status].label }}</span>
              </li>
            </ul>

            <section v-if="!isAdmin" id="work" class="work">
              <header class="work__head">
                <span class="section__icon"><BriefcaseBusiness /></span>
                <div>
                  <h3 class="section-title">{{ t('settings.form.workTitle') }}</h3>
                  <p class="muted">{{ t('settings.form.workLead') }}</p>
                </div>
              </header>
              <UiToggle
                v-model="form.availableForWork"
                :label="t('settings.form.available')"
                :description="t('settings.form.availableText')"
              />
              <div class="rate-grid">
                <UiSelect v-model="form.currency" :label="t('settings.form.currency')" :options="CURRENCIES" />
                <UiInput
                  v-model="form.rateAmount"
                  :label="t('settings.form.rate')"
                  type="number"
                  min="1"
                  inputmode="numeric"
                  :placeholder="t('settings.form.ratePh')"
                  :error="errors.rateAmount"
                  :hint="t('settings.form.rateHint')"
                />
                <UiSelect v-model="form.rateUnit" :label="t('settings.form.charged')" :options="unitOptions" :error="errors.rateUnit" />
              </div>
            </section>

            <section id="contact" class="work">
              <header class="work__head">
                <span class="section__icon"><Contact /></span>
                <div>
                  <h3 class="section-title">{{ t('settings.form.contactTitle') }}</h3>
                  <p class="muted">
                    {{ t('settings.form.contactLead') }}
                    <RouterLink to="/privacy#visibility" class="summary__link">{{ t('nav.privacy') }}</RouterLink>.
                  </p>
                </div>
              </header>
              <div class="form-grid form-grid--2">
                <UiInput
                  v-model.trim="form.contactEmail"
                  :label="t('settings.form.email')"
                  type="email"
                  maxlength="160"
                  :icon="Mail"
                  :placeholder="me.email"
                  autocomplete="email"
                  :error="errors.contactEmail"
                  :hint="t('settings.form.emailHint')"
                />
                <UiInput
                  v-model.trim="form.phone"
                  :label="t('settings.form.mobile')"
                  type="tel"
                  maxlength="20"
                  :icon="Phone"
                  placeholder="+91 98765 43210"
                  inputmode="tel"
                  autocomplete="tel"
                  :error="errors.phone"
                />
              </div>
              <UiTextarea
                v-model="form.address"
                :label="t('settings.form.address')"
                :maxlength="300"
                :rows="3"
                :placeholder="t('settings.form.addressPh')"
                autocomplete="street-address"
                :error="errors.address"
              />
            </section>
            <UiTextarea
              v-model="form.bio"
              :label="t('settings.form.about')"
              :maxlength="2000"
              :rows="5"
              :placeholder="t('settings.aboutEmpty')"
              :error="errors.bio"
            />
            <UiTagInput v-model="form.skills" :label="t('settings.form.skills')" :placeholder="t('settings.form.skillsPh')" :error="errors.skills" />

            <div class="form-actions" :class="{ 'is-dirty': dirty }">
              <span v-if="dirty" class="muted">{{ t('settings.unsaved') }}</span>
              <div class="row" style="margin-left: auto">
                <UiButton variant="ghost" :disabled="saving" @click="cancelEdit">{{ t('common.cancel') }}</UiButton>
                <UiButton type="submit" :icon="Save" :loading="saving" :disabled="!dirty">{{ t('common.saveChanges') }}</UiButton>
              </div>
            </div>
          </form>
        </UiCard>

        <!-- Location -->
        <UiCard v-if="!isAdmin" id="location" class="section">
          <header class="section__head">
            <span class="section__icon"><MapPin /></span>
            <div>
              <h2 class="section-title">{{ t('settings.locationTitle') }}</h2>
              <p class="muted">{{ t('settings.locationLead') }}</p>
            </div>
          </header>

          <div class="stack" style="--gap: 18px">
            <UiToggle
              v-model="shareLocation"
              :icon="LocateFixed"
              :label="t('settings.shareLocation')"
              :description="t('settings.shareLocationText')"
              :loading="pending.location || geo.loading.value"
            />

            <LocationCard v-if="me.hasLocation" @address-saved="(address) => (form.address = address)" />
            <p v-if="geo.error.value" class="error-text">{{ geo.error.value }}</p>

            <UiRange
              v-model="radiusIdx"
              :min="0"
              :max="RADIUS_STEPS.length - 1"
              :label="t('settings.radius')"
              :format="(i) => `${RADIUS_STEPS[i]} km`"
              :disabled="!me.hasLocation"
              :marks="['1 km', '500 km']"
            />

            <UiToggle
              v-model="discoverable"
              :icon="Eye"
              :label="t('settings.discoverable')"
              :description="t('settings.discoverableText')"
              :loading="pending.discoverable"
            />
          </div>
        </UiCard>

        <!-- Notifications -->
        <UiCard id="notifications" class="section">
          <header class="section__head">
            <span class="section__icon"><BellRing /></span>
            <div>
              <h2 class="section-title">{{ t('notify.title') }}</h2>
              <p class="muted">{{ t('notify.lead') }}</p>
            </div>
          </header>
          <NotificationPrefs />
        </UiCard>

        <!-- Security -->
        <UiCard id="security" class="section">
          <header class="section__head">
            <span class="section__icon"><KeyRound /></span>
            <div>
              <h2 class="section-title">{{ t('settings.securityTitle') }}</h2>
              <p class="muted">{{ t('settings.securityLead') }}</p>
            </div>
          </header>
          <form class="stack" style="--gap: 16px" novalidate @submit.prevent="changePassword">
            <UiInput
              v-model="pw.currentPassword"
              :label="t('settings.currentPassword')"
              type="password"
              autocomplete="current-password"
              :error="pwErrors.currentPassword"
            />
            <div class="form-grid form-grid--2">
              <UiInput
                v-model="pw.newPassword"
                :label="t('settings.newPassword')"
                type="password"
                autocomplete="new-password"
                :error="pwErrors.newPassword"
                :hint="t('auth.passwordHint')"
              />
              <UiInput
                v-model="pw.confirm"
                :label="t('settings.confirmPassword')"
                type="password"
                autocomplete="new-password"
                :error="pwErrors.confirm"
              />
            </div>
            <div class="row" style="justify-content: space-between; flex-wrap: wrap">
              <RouterLink :to="{ name: 'forgot-password', query: { email: me.email } }" class="summary__link forgot-link">
                {{ t('settings.forgotLink') }}
              </RouterLink>
              <UiButton type="submit" :loading="pwSaving" :disabled="!pw.currentPassword || !pw.newPassword">
                {{ t('settings.updatePassword') }}
              </UiButton>
            </div>
          </form>
        </UiCard>

        <!-- Sessions, blocks and data -->
        <UiCard id="sessions" class="section section--full">
          <header class="section__head">
            <span class="section__icon"><MonitorSmartphone /></span>
            <div>
              <h2 class="section-title">{{ t('settings.sessionsTitle') }}</h2>
              <p class="muted">{{ t('settings.sessionsLead') }}</p>
            </div>
          </header>
          <AccountSafety />
        </UiCard>

        <!-- Privacy -->
        <UiCard v-if="!isAdmin" id="privacy" class="section">
          <header class="section__head">
            <span class="section__icon"><ShieldCheck /></span>
            <div>
              <h2 class="section-title">{{ t('settings.privacyTitle') }}</h2>
              <p class="muted">{{ t('settings.privacyLead') }}</p>
            </div>
          </header>
          <UiToggle
            v-model="showOnline"
            :icon="Wifi"
            :label="t('settings.showOnline')"
            :description="t('settings.showOnlineText')"
            :loading="pending.showOnlineStatus"
          />
        </UiCard>

        <!-- Appearance & language -->
        <UiCard id="appearance" class="section">
          <header class="section__head">
            <span class="section__icon"><Palette /></span>
            <div>
              <h2 class="section-title">{{ t('settings.appearanceTitle') }}</h2>
              <p class="muted">{{ t('settings.appearanceLead') }}</p>
            </div>
          </header>
          <h3 class="summary__label appearance-label">{{ t('settings.themeLabel') }}</h3>
          <div class="theme-grid" role="radiogroup" :aria-label="t('settings.themeLabel')">
            <button
              v-for="o in themeOptions"
              :key="o.value"
              type="button"
              role="radio"
              class="theme-opt"
              :class="{ 'is-active': theme.mode === o.value }"
              :aria-checked="theme.mode === o.value"
              @click="theme.mode = o.value"
            >
              <span class="theme-opt__preview" :data-preview="o.value"><span /><span /></span>
              <span class="row" style="--gap: 6px"><component :is="o.icon" /> {{ o.label }}</span>
            </button>
          </div>
          <h3 class="summary__label appearance-label"><Languages class="inline-icon" /> {{ t('common.language') }}</h3>
          <LanguageSwitcher variant="pills" />
          <p class="subtle lang-hint">{{ t('settings.languageHint') }}</p>
        </UiCard>

        <!-- Admin -->
        <UiCard v-if="me.role === 'admin'" class="section account">
          <div class="row grow" style="--gap: 12px">
            <span class="section__icon"><ShieldHalf /></span>
            <div class="grow" style="min-width: 0">
              <strong>{{ t('settings.adminTitle') }}</strong>
              <p class="muted">{{ t('settings.adminText') }}</p>
            </div>
          </div>
          <UiButton to="/admin" variant="soft" :icon-right="ChevronRight">{{ t('common.open') }}</UiButton>
        </UiCard>

        <!-- Account -->
        <UiCard class="section account">
          <div class="row grow" style="--gap: 12px">
            <span class="section__icon"><Mail /></span>
            <div class="grow" style="min-width: 0">
              <strong>{{ t('settings.signedInAs') }}</strong>
              <p class="muted truncate">{{ me.email }}</p>
            </div>
            <UiBadge tone="success" dot class="desktop-badge">{{ t('settings.active') }}</UiBadge>
          </div>
          <UiButton variant="danger" :icon="LogOut" @click="logout">{{ t('common.signOut') }}</UiButton>
        </UiCard>

        <!-- Danger zone -->
        <UiCard class="section danger">
          <div class="grow">
            <h2 class="section-title danger__title"><TriangleAlert /> {{ t('settings.deleteTitle') }}</h2>
            <p class="muted">{{ t('settings.deleteText') }}</p>
          </div>
          <UiButton variant="danger" :icon="Trash2" @click="openDelete">{{ t('settings.deleteTitle') }}</UiButton>
        </UiCard>
      </div>
    </div>

    <UiSheet v-model:open="deleteOpen" :title="t('settings.deleteSheet')" width="440px">
      <form id="delete-form" class="stack" style="--gap: 14px" novalidate @submit.prevent="deleteAccount">
        <p class="muted">{{ t('settings.deleteConfirm', { email: me.email }) }}</p>
        <UiInput
          v-model="deletePassword"
          :label="t('auth.password')"
          type="password"
          autocomplete="current-password"
          :error="deleteError"
        />
      </form>
      <template #footer>
        <UiButton variant="secondary" class="grow" @click="deleteOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton
          type="submit"
          form="delete-form"
          variant="danger"
          class="grow"
          :icon="Trash2"
          :loading="deleting"
          :disabled="!deletePassword"
        >
          {{ t('settings.deleteForever') }}
        </UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.settings__nav {
  display: none;
}
.verify-banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, var(--border));
  background: var(--warning-soft);
}
.verify-banner p {
  font-size: 0.86rem;
}
.verify-banner__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--surface);
  color: var(--warning);
}
.verify-banner__icon svg {
  width: 20px;
  height: 20px;
}
.appearance-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0 10px;
}
.theme-grid + .appearance-label {
  margin-top: 20px;
}
.inline-icon {
  width: 14px;
  height: 14px;
}
.lang-hint {
  margin-top: 10px;
  font-size: 0.8rem;
}
.forgot-link {
  font-size: 0.86rem;
  color: var(--primary);
}
.settings__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}
.section {
  scroll-margin-top: calc(var(--nav-h) + 16px);
}
.section--full {
  grid-column: 1 / -1;
}
.nav-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.nav-list {
  display: flex;
  flex-direction: column;
  padding: 6px;
}
.section__head {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 20px;
}
.section__head p {
  font-size: 0.88rem;
}
.section__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 13px;
  background: var(--primary-soft);
  color: var(--primary);
}
.section__icon svg {
  width: 20px;
  height: 20px;
}
.requests {
  list-style: none;
  margin: -6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.requests li {
  --tone: var(--warning);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--tone) 9%, transparent);
  font-size: 0.88rem;
}
.requests li.requests__item--success {
  --tone: var(--success);
}
.requests li.requests__item--danger {
  --tone: var(--danger);
}
.requests__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--tone);
}
.requests__status {
  flex-shrink: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--tone);
}
.requests__note {
  font-size: 0.8rem;
  color: var(--text-2);
  margin-top: 2px;
}
.work {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  scroll-margin-top: calc(var(--nav-h) + 16px);
}
.work__head {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.work__head p {
  font-size: 0.88rem;
}
.rate-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 640px) {
  .rate-grid {
    grid-template-columns: 140px minmax(0, 1fr) 200px;
    align-items: start;
  }
}
.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.summary {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.summary__top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
}
.summary__who {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.summary__name {
  font-size: 1.15rem;
}
.summary__headline {
  font-size: 0.9rem;
  color: var(--text-2);
}
.summary__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.summary__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 14px;
  border-radius: var(--radius);
  background: var(--surface-2);
}
.summary__grid > div {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}
.summary__item--wide {
  grid-column: 1 / -1;
}
.summary__icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-2);
}
.summary__icon svg {
  width: 16px;
  height: 16px;
}
.summary__text {
  min-width: 0;
}
.summary__text dt {
  font-size: 0.74rem;
  color: var(--text-3);
}
.summary__text dd {
  margin: 1px 0 0;
  font-weight: 600;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
.summary__text dd a {
  color: var(--primary);
}
.summary__text dd a:hover {
  text-decoration: underline;
}
.summary__link {
  font-weight: 600;
}
.summary__empty {
  font-weight: 500;
  color: var(--text-3);
  font-size: 0.88rem;
}
.summary__block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.summary__label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
}
.summary__bio {
  font-size: 0.92rem;
  color: var(--text-2);
  white-space: pre-line;
}
.summary__skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.summary__skill {
  padding: 5px 12px;
  border-radius: var(--radius-full);
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
  font-size: 0.82rem;
}
.error-text {
  color: var(--danger);
  font-size: 0.86rem;
}
.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.theme-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
  background: var(--surface);
  font-weight: 600;
  font-size: 0.88rem;
  transition: all 0.18s var(--ease);
}
.theme-opt svg {
  width: 16px;
  height: 16px;
}
.theme-opt.is-active {
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.theme-opt__preview {
  width: 100%;
  height: 56px;
  border-radius: 10px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border);
}
.theme-opt__preview span {
  height: 10px;
  border-radius: 4px;
}
.theme-opt__preview span:last-child {
  width: 60%;
}
.theme-opt__preview[data-preview='light'] {
  background: #f3f5fb;
}
.theme-opt__preview[data-preview='light'] span {
  background: #d9ddf0;
}
.theme-opt__preview[data-preview='dark'] {
  background: #0b1020;
}
.theme-opt__preview[data-preview='dark'] span {
  background: #2e3d6b;
}
.theme-opt__preview[data-preview='system'] {
  background: linear-gradient(135deg, #f3f5fb 50%, #0b1020 50%);
}
.theme-opt__preview[data-preview='system'] span {
  background: #7c74ff;
  opacity: 0.6;
}
.danger {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
}
.danger p {
  font-size: 0.88rem;
  margin-top: 4px;
}
.danger__title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--danger);
}
.danger__title svg {
  width: 18px;
  height: 18px;
}
.account {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.9rem;
  text-align: left;
  transition: background-color 0.15s var(--ease), color 0.15s var(--ease);
}
.nav-link:hover {
  background: var(--surface-2);
  color: var(--text);
}
.nav-link svg {
  width: 18px;
  height: 18px;
}

@media (max-width: 559px) {
  .account > :last-child,
  .danger > :last-child {
    width: 100%;
  }
  .desktop-badge {
    display: none;
  }
  .form-actions .row {
    width: 100%;
  }
  .form-actions .row > * {
    flex: 1;
  }
}

@media (min-width: 1024px) {
  .settings__nav {
    display: flex;
  }
}

/* Pair the smaller cards side by side on wide screens; the profile form keeps the full width. */
@media (min-width: 1280px) {
  .settings__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
