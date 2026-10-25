<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
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
  RefreshCw,
  Mail,
  Navigation,
  KeyRound,
  Trash2,
  TriangleAlert,
  BriefcaseBusiness,
  Hourglass,
  CircleCheck,
  CircleX,
  ShieldHalf,
  ChevronRight,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useProfessionsStore } from '@/stores/professions';
import { useGeolocation } from '@/composables/useGeolocation';
import { toast } from '@/composables/useToast';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { DISTANCE_STEPS, stepForRadius } from '@/constants/filters';
import { RATE_UNITS, CURRENCIES } from '@/constants/professions';
import UiSelect from '@/components/ui/UiSelect.vue';
import { timeAgo } from '@/utils/format';
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

const auth = useAuthStore();
const theme = useThemeStore();
const geo = useGeolocation();
const router = useRouter();
const me = computed(() => auth.user);

const professions = useProfessionsStore();

const sections = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'work', label: 'Work & rates', icon: BriefcaseBusiness },
  { id: 'location', label: 'Location & discovery', icon: MapPin },
  { id: 'security', label: 'Security', icon: KeyRound },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

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
    toast.success('Profile saved');
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
        if (await geo.locate()) toast.success('Location sharing is on');
        else toast.error(geo.error.value);
      } else {
        await auth.clearLocation();
        toast.success('Location sharing is off and your coordinates were removed');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      pending.location = false;
    }
  },
});

async function refreshLocation() {
  if (await geo.locate()) toast.success('Location updated');
  else toast.error(geo.error.value);
}

const showOnline = computed({
  get: () => me.value.showOnlineStatus,
  set: (v) => setSetting('showOnlineStatus', v, v ? 'Others can see when you are online' : 'You now appear offline to everyone'),
});

const discoverable = computed({
  get: () => me.value.discoverable,
  set: (v) => setSetting('discoverable', v, v ? 'Your profile appears in Discover' : 'Your profile is hidden from Discover'),
});

const RADIUS_STEPS = DISTANCE_STEPS.filter((s) => s != null);
const radiusIdx = ref(Math.min(stepForRadius(me.value.discoveryRadiusKm), RADIUS_STEPS.length - 1));
let radiusTimer;
watch(radiusIdx, (i) => {
  clearTimeout(radiusTimer);
  radiusTimer = setTimeout(() => setSetting('discoveryRadiusKm', RADIUS_STEPS[i]), 500);
});

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function scrollTo(id) {
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
  if (pw.newPassword.length < 8) pwErrors.value.newPassword = 'Use at least 8 characters';
  if (pw.newPassword !== pw.confirm) pwErrors.value.confirm = 'Passwords do not match';
  if (Object.keys(pwErrors.value).length) return;

  pwSaving.value = true;
  try {
    await auth.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
    Object.assign(pw, { currentPassword: '', newPassword: '', confirm: '' });
    toast.success('Password updated. Other devices have been signed out.');
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
    toast.info('Your account has been deleted. Sorry to see you go.');
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
        <nav class="nav-list" aria-label="Settings sections">
          <button v-for="s in sections" :key="s.id" type="button" class="nav-link" @click="scrollTo(s.id)">
            <component :is="s.icon" /> {{ s.label }}
          </button>
        </nav>
      </UiCard>
    </aside>

    <div class="page-main">
      <header class="page-head">
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="muted">Manage your profile, privacy and account.</p>
        </div>
      </header>

      <div class="settings__grid">
        <!-- Profile -->
        <UiCard id="profile" class="section section--full">
          <header class="section__head">
            <span class="section__icon"><UserRound /></span>
            <div>
              <h2 class="section-title">Profile</h2>
              <p class="muted">This is what other members see on your profile.</p>
            </div>
          </header>

          <form class="stack" style="--gap: 18px" novalidate @submit.prevent="saveProfile">
            <AvatarUploader />

            <div class="form-grid form-grid--2">
              <UiInput v-model="form.name" label="Full name" maxlength="80" :error="errors.name" autocomplete="name" />
              <UiInput v-model="form.roleTitle" label="Role / title" maxlength="100" placeholder="e.g. Pediatrician" :error="errors.roleTitle" />
              <UiInput
                v-model="form.headline"
                class="span-2"
                label="Headline"
                maxlength="160"
                placeholder="A one-liner about what you do"
                :error="errors.headline"
              />
              <UiInput v-model="form.city" label="City" maxlength="100" placeholder="e.g. Bengaluru" :error="errors.city" />
              <UiInput
                v-model.number="form.experienceYears"
                label="Years of experience"
                type="number"
                min="0"
                max="70"
                inputmode="numeric"
                :error="errors.experienceYears"
              />
            </div>

            <ProfessionPicker
              v-model="form.profession"
              label="Profession"
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

            <section id="work" class="work">
              <header class="work__head">
                <span class="section__icon"><BriefcaseBusiness /></span>
                <div>
                  <h3 class="section-title">Work &amp; rates</h3>
                  <p class="muted">Tell people you're open to work and what you charge. Shown on your profile and cards.</p>
                </div>
              </header>
              <UiToggle
                v-model="form.availableForWork"
                label="Available for work"
                description="Shows an “Available” badge and includes you in the hiring filter on Discover."
              />
              <div class="rate-grid">
                <UiSelect v-model="form.currency" label="Currency" :options="CURRENCIES" />
                <UiInput
                  v-model="form.rateAmount"
                  label="Your rate"
                  type="number"
                  min="1"
                  inputmode="numeric"
                  placeholder="e.g. 500"
                  :error="errors.rateAmount"
                  hint="Leave empty to hide your rate"
                />
                <UiSelect v-model="form.rateUnit" label="Charged" :options="unitOptions" :error="errors.rateUnit" />
              </div>
            </section>
            <UiTextarea v-model="form.bio" label="About" :maxlength="2000" :rows="5" placeholder="Tell people about your work, interests and what you're looking for." :error="errors.bio" />
            <UiTagInput v-model="form.skills" label="Skills" placeholder="Add a skill and press Enter" :error="errors.skills" />

            <div class="form-actions" :class="{ 'is-dirty': dirty }">
              <span v-if="dirty" class="muted">You have unsaved changes</span>
              <div class="row" style="margin-left: auto">
                <UiButton variant="ghost" :disabled="!dirty || saving" @click="resetProfile">Discard</UiButton>
                <UiButton type="submit" :icon="Save" :loading="saving" :disabled="!dirty">Save changes</UiButton>
              </div>
            </div>
          </form>
        </UiCard>

        <!-- Location -->
        <UiCard id="location" class="section">
          <header class="section__head">
            <span class="section__icon"><MapPin /></span>
            <div>
              <h2 class="section-title">Location & discovery</h2>
              <p class="muted">Control how distance-based discovery works for you.</p>
            </div>
          </header>

          <div class="stack" style="--gap: 18px">
            <UiToggle
              v-model="shareLocation"
              :icon="LocateFixed"
              label="Share my location"
              description="Lets you filter by range and shows others how far you are. Your exact coordinates are never shown."
              :loading="pending.location || geo.loading.value"
            />

            <div v-if="me.hasLocation" class="location-status">
              <Navigation />
              <div class="grow">
                <strong>{{ me.city || 'Location set' }}</strong>
                <span class="muted">Updated {{ timeAgo(me.locationUpdatedAt) }}</span>
              </div>
              <UiButton variant="secondary" size="sm" :icon="RefreshCw" :loading="geo.loading.value" @click="refreshLocation">
                Update
              </UiButton>
            </div>
            <p v-if="geo.error.value" class="error-text">{{ geo.error.value }}</p>

            <UiRange
              v-model="radiusIdx"
              :min="0"
              :max="RADIUS_STEPS.length - 1"
              label="Default discovery radius"
              :format="(i) => `${RADIUS_STEPS[i]} km`"
              :disabled="!me.hasLocation"
              :marks="['1 km', '500 km']"
            />

            <UiToggle
              v-model="discoverable"
              :icon="Eye"
              label="Show me in Discover"
              description="When off, people can still open your profile via a direct link or your network."
              :loading="pending.discoverable"
            />
          </div>
        </UiCard>

        <!-- Security -->
        <UiCard id="security" class="section">
          <header class="section__head">
            <span class="section__icon"><KeyRound /></span>
            <div>
              <h2 class="section-title">Security</h2>
              <p class="muted">Changing your password signs you out on every other device.</p>
            </div>
          </header>
          <form class="stack" style="--gap: 16px" novalidate @submit.prevent="changePassword">
            <UiInput
              v-model="pw.currentPassword"
              label="Current password"
              type="password"
              autocomplete="current-password"
              :error="pwErrors.currentPassword"
            />
            <div class="form-grid form-grid--2">
              <UiInput
                v-model="pw.newPassword"
                label="New password"
                type="password"
                autocomplete="new-password"
                :error="pwErrors.newPassword"
                hint="At least 8 characters"
              />
              <UiInput
                v-model="pw.confirm"
                label="Confirm new password"
                type="password"
                autocomplete="new-password"
                :error="pwErrors.confirm"
              />
            </div>
            <div class="row" style="justify-content: flex-end">
              <UiButton type="submit" :loading="pwSaving" :disabled="!pw.currentPassword || !pw.newPassword">
                Update password
              </UiButton>
            </div>
          </form>
        </UiCard>

        <!-- Privacy -->
        <UiCard id="privacy" class="section">
          <header class="section__head">
            <span class="section__icon"><ShieldCheck /></span>
            <div>
              <h2 class="section-title">Privacy</h2>
              <p class="muted">Choose what others can see about your activity.</p>
            </div>
          </header>
          <UiToggle
            v-model="showOnline"
            :icon="Wifi"
            label="Show online status"
            description="When off, you appear offline and your last-seen time is hidden."
            :loading="pending.showOnlineStatus"
          />
        </UiCard>

        <!-- Appearance -->
        <UiCard id="appearance" class="section">
          <header class="section__head">
            <span class="section__icon"><Palette /></span>
            <div>
              <h2 class="section-title">Appearance</h2>
              <p class="muted">Pick a theme or follow your device.</p>
            </div>
          </header>
          <div class="theme-grid" role="radiogroup" aria-label="Theme">
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
        </UiCard>

        <!-- Admin -->
        <UiCard v-if="me.role === 'admin'" class="section account">
          <div class="row grow" style="--gap: 12px">
            <span class="section__icon"><ShieldHalf /></span>
            <div class="grow" style="min-width: 0">
              <strong>Admin panel</strong>
              <p class="muted">Review profession requests and manage the profession list.</p>
            </div>
          </div>
          <UiButton to="/admin" variant="soft" :icon-right="ChevronRight">Open</UiButton>
        </UiCard>

        <!-- Account -->
        <UiCard class="section account">
          <div class="row grow" style="--gap: 12px">
            <span class="section__icon"><Mail /></span>
            <div class="grow" style="min-width: 0">
              <strong>Signed in as</strong>
              <p class="muted truncate">{{ me.email }}</p>
            </div>
            <UiBadge tone="success" dot class="desktop-badge">Active</UiBadge>
          </div>
          <UiButton variant="danger" :icon="LogOut" @click="logout">Sign out</UiButton>
        </UiCard>

        <!-- Danger zone -->
        <UiCard class="section danger">
          <div class="grow">
            <h2 class="section-title danger__title"><TriangleAlert /> Delete account</h2>
            <p class="muted">
              Permanently removes your profile, connections, messages and photo. This cannot be undone.
            </p>
          </div>
          <UiButton variant="danger" :icon="Trash2" @click="openDelete">Delete account</UiButton>
        </UiCard>
      </div>
    </div>

    <UiSheet v-model:open="deleteOpen" title="Delete your account?" width="440px">
      <form id="delete-form" class="stack" style="--gap: 14px" novalidate @submit.prevent="deleteAccount">
        <p class="muted">
          Everything tied to <strong>{{ me.email }}</strong> will be erased immediately. Enter your password to confirm.
        </p>
        <UiInput
          v-model="deletePassword"
          label="Password"
          type="password"
          autocomplete="current-password"
          :error="deleteError"
        />
      </form>
      <template #footer>
        <UiButton variant="secondary" class="grow" @click="deleteOpen = false">Cancel</UiButton>
        <UiButton
          type="submit"
          form="delete-form"
          variant="danger"
          class="grow"
          :icon="Trash2"
          :loading="deleting"
          :disabled="!deletePassword"
        >
          Delete forever
        </UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.settings__nav {
  display: none;
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
.location-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--success-soft);
}
.location-status > svg {
  width: 20px;
  height: 20px;
  color: var(--success);
}
.location-status strong {
  display: block;
}
.location-status span {
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
