<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { Ban, CircleCheck, Trash2, Crown, Save, ExternalLink, ShieldHalf, Mail, Phone, KeyRound } from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import { formatPlanPrice, formatDate } from '@/constants/plans';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiToggle from '@/components/ui/UiToggle.vue';
import UiSpinner from '@/components/ui/UiSpinner.vue';
import ProfessionPicker from '@/components/ProfessionPicker.vue';

const open = defineModel('open', { type: Boolean, default: false });
const props = defineProps({
  userId: { type: String, default: '' },
  plans: { type: Array, default: () => [] },
});
const emit = defineEmits(['saved', 'deleted']);

const user = ref(null);
const stats = ref(null);
const loading = ref(false);
const busy = ref('');
const errors = ref({});

const profile = reactive({});
const PROFILE_FIELDS = ['name', 'email', 'roleTitle', 'headline', 'city', 'profession', 'contactEmail', 'phone', 'address', 'bio', 'availableForWork', 'discoverable'];
const planForm = reactive({ planId: '', expires: '' });
const role = ref('member');
const confirmDelete = ref(false);
const deleteText = ref('');

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function fill(u) {
  user.value = u;
  for (const key of PROFILE_FIELDS) profile[key] = u[key] ?? (typeof u[key] === 'boolean' ? false : '');
  planForm.planId = u.planId || '';
  planForm.expires = toDateInput(u.planExpiresAt);
  role.value = u.role;
  errors.value = {};
}

async function load() {
  if (!props.userId) return;
  loading.value = true;
  user.value = null;
  confirmDelete.value = false;
  deleteText.value = '';
  try {
    const { data } = await api.get(`/admin/users/${props.userId}`);
    fill(data.user);
    stats.value = data.stats;
  } catch (err) {
    toast.error(errorMessage(err));
    open.value = false;
  } finally {
    loading.value = false;
  }
}
watch(() => [open.value, props.userId], ([isOpen]) => isOpen && load(), { immediate: true });

async function patch(body, key, message) {
  busy.value = key;
  errors.value = {};
  try {
    const { data } = await api.patch(`/admin/users/${user.value.id}`, body);
    fill({ ...user.value, ...data.user });
    toast.success(message);
    emit('saved');
    return true;
  } catch (err) {
    errors.value = fieldErrors(err);
    toast.error(errorMessage(err));
    return false;
  } finally {
    busy.value = '';
  }
}

const planOptions = computed(() =>
  props.plans.map((p) => ({
    value: p.id,
    label: `${p.name} · ${formatPlanPrice(p)}${p.isDefault ? ' (default)' : p.active ? '' : ' (hidden)'}`,
  })),
);
const pickedPlan = computed(() => props.plans.find((p) => p.id === planForm.planId) || null);
const planChanged = computed(
  () => planForm.planId !== (user.value?.planId || '') || planForm.expires !== toDateInput(user.value?.planExpiresAt),
);

function savePlan() {
  if (!planForm.planId) return patch({ planId: null }, 'plan', 'Plan removed');
  const body = { planId: planForm.planId };
  // Switching plans without picking a date lets the server set the expiry from the billing period.
  if (planForm.planId === user.value.planId || planForm.expires) body.planExpiresAt = planForm.expires || null;
  return patch(body, 'plan', `${pickedPlan.value?.name || 'Plan'} assigned`);
}

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
];
function saveRole() {
  return patch({ role: role.value }, 'role', role.value === 'admin' ? `${user.value.name} is now an admin` : `${user.value.name} is now a member`);
}

function toggleSuspend() {
  const suspend = !user.value.suspendedAt;
  return patch(
    { suspended: suspend },
    'suspend',
    suspend ? `${user.value.name} was suspended and signed out` : `${user.value.name} can sign in again`,
  );
}

function saveProfile() {
  const body = Object.fromEntries(PROFILE_FIELDS.map((k) => [k, typeof profile[k] === 'string' ? profile[k].trim() : profile[k]]));
  return patch(body, 'profile', 'Profile updated');
}

async function remove() {
  busy.value = 'delete';
  try {
    await api.delete(`/admin/users/${user.value.id}`);
    toast.success(`${user.value.name}'s account was deleted`);
    emit('deleted');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = '';
  }
}

const statRows = computed(() =>
  stats.value
    ? [
        { label: 'Connections', value: stats.value.connections },
        { label: 'Active listings', value: `${stats.value.activeListings} of ${stats.value.totalListings}` },
        { label: 'Messages sent', value: stats.value.messagesSent },
        { label: 'Pending invites', value: stats.value.pendingRequests },
        { label: 'Joined', value: formatDate(user.value.createdAt) },
        { label: 'Last seen', value: user.value.isOnline ? 'Online now' : user.value.lastSeenAt ? timeAgo(user.value.lastSeenAt) : 'Never' },
      ]
    : [],
);
</script>

<template>
  <UiSheet v-model:open="open" :title="user ? user.name : 'Account'" width="620px">
    <div v-if="loading || !user" class="center"><UiSpinner :size="26" /></div>

    <div v-else class="stack" style="--gap: 22px">
      <header class="head">
        <UiAvatar :name="user.name" :src="user.avatarUrl" :size="64" />
        <div class="grow" style="min-width: 0">
          <strong class="head__name">{{ user.name }}</strong>
          <span class="muted head__email">{{ user.email }}</span>
          <div class="head__badges">
            <UiBadge v-if="user.suspendedAt" tone="danger" :icon="Ban">Suspended {{ timeAgo(user.suspendedAt) }}</UiBadge>
            <UiBadge v-if="user.role === 'admin'" tone="primary" :icon="ShieldHalf">Admin</UiBadge>
            <UiBadge v-if="user.isMainAdmin" tone="warning" :icon="KeyRound">Main admin (.env)</UiBadge>
            <UiBadge v-if="user.plan" tone="success" :icon="Crown">{{ user.plan.name }}</UiBadge>
          </div>
        </div>
        <UiButton variant="secondary" size="sm" :icon="ExternalLink" :to="`/u/${user.id}`">Profile</UiButton>
      </header>

      <dl class="stats">
        <div v-for="s in statRows" :key="s.label">
          <dt>{{ s.label }}</dt>
          <dd>{{ s.value }}</dd>
        </div>
      </dl>

      <!-- Plan -->
      <section class="block">
        <h3 class="block__title"><Crown /> Plan</h3>
        <div class="grid-2">
          <UiSelect v-model="planForm.planId" label="Plan" :options="planOptions" :error="errors.planId" />
          <UiInput
            v-model="planForm.expires"
            type="date"
            label="Expires on"
            :disabled="!planForm.planId"
            :hint="planForm.planId && planForm.planId !== user.planId ? 'Leave empty to use the plan\'s billing period' : 'Empty means it never expires'"
            :error="errors.planExpiresAt"
          />
        </div>
        <p v-if="!plans.length" class="subtle note">Create a plan in the Plans tab first.</p>
        <div class="actions">
          <UiButton size="sm" :icon="Save" :loading="busy === 'plan'" :disabled="!planChanged" @click="savePlan">Save plan</UiButton>
        </div>
      </section>

      <!-- Access -->
      <section class="block">
        <h3 class="block__title"><ShieldHalf /> Access</h3>
        <div class="grid-2 align-end">
          <UiSelect v-model="role" label="Role" :options="ROLE_OPTIONS" :disabled="user.isMainAdmin" />
          <UiButton variant="secondary" :loading="busy === 'role'" :disabled="role === user.role" @click="saveRole">Change role</UiButton>
        </div>
        <div class="suspend" :class="{ 'is-suspended': user.suspendedAt }">
          <div class="grow">
            <strong>{{ user.suspendedAt ? 'This account is suspended' : 'Suspend account' }}</strong>
            <p class="muted">
              {{
                user.suspendedAt
                  ? 'They cannot sign in and are hidden from Discover and search. Reactivate to restore access.'
                  : 'Signs them out everywhere, blocks sign-in and hides them from Discover and search. Nothing is deleted.'
              }}
            </p>
          </div>
          <UiButton
            :variant="user.suspendedAt ? 'primary' : 'danger'"
            size="sm"
            :icon="user.suspendedAt ? CircleCheck : Ban"
            :loading="busy === 'suspend'"
            :disabled="user.isMainAdmin"
            @click="toggleSuspend"
          >
            {{ user.suspendedAt ? 'Reactivate' : 'Suspend' }}
          </UiButton>
        </div>
      </section>

      <!-- Profile -->
      <section class="block">
        <h3 class="block__title">Profile</h3>
        <div class="grid-2">
          <UiInput v-model="profile.name" label="Full name" maxlength="80" :error="errors.name" />
          <UiInput v-model="profile.email" label="Sign-in email" type="email" maxlength="160" :error="errors.email" />
          <UiInput v-model="profile.roleTitle" label="Role / title" maxlength="100" :error="errors.roleTitle" />
          <UiInput v-model="profile.city" label="City" maxlength="100" :error="errors.city" />
        </div>
        <UiInput v-model="profile.headline" label="Headline" maxlength="160" :error="errors.headline" />
        <ProfessionPicker v-model="profile.profession" label="Profession" :quick-picks="false" :error="errors.profession" />
        <div class="grid-2">
          <UiInput v-model="profile.contactEmail" label="Contact email" type="email" :icon="Mail" maxlength="160" :error="errors.contactEmail" />
          <UiInput v-model="profile.phone" label="Mobile number" type="tel" :icon="Phone" maxlength="20" :error="errors.phone" />
        </div>
        <UiTextarea v-model="profile.address" label="Address" :maxlength="300" :rows="2" :error="errors.address" />
        <UiTextarea v-model="profile.bio" label="About" :maxlength="2000" :rows="3" :error="errors.bio" />
        <UiToggle v-model="profile.availableForWork" label="Available for work" />
        <UiToggle v-model="profile.discoverable" label="Show in Discover" />
        <div class="actions">
          <UiButton size="sm" :icon="Save" :loading="busy === 'profile'" @click="saveProfile">Save profile</UiButton>
        </div>
      </section>

      <!-- Danger -->
      <section v-if="!user.isMainAdmin" class="block danger">
        <h3 class="block__title"><Trash2 /> Delete account</h3>
        <p class="muted">
          Permanently removes {{ user.name }}'s profile, connections, messages, listings and photos. This cannot be undone.
        </p>
        <template v-if="confirmDelete">
          <UiInput v-model="deleteText" label="Type DELETE to confirm" placeholder="DELETE" />
          <div class="actions">
            <UiButton variant="ghost" size="sm" @click="confirmDelete = false">Cancel</UiButton>
            <UiButton
              variant="danger"
              size="sm"
              :icon="Trash2"
              :loading="busy === 'delete'"
              :disabled="deleteText !== 'DELETE'"
              @click="remove"
            >
              Delete permanently
            </UiButton>
          </div>
        </template>
        <div v-else class="actions">
          <UiButton variant="danger" size="sm" :icon="Trash2" @click="confirmDelete = true">Delete account…</UiButton>
        </div>
      </section>
    </div>
  </UiSheet>
</template>

<style scoped>
.center {
  display: grid;
  place-items: center;
  padding: 40px;
}
.head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.head__name {
  display: block;
  font-size: 1.1rem;
}
.head__email {
  display: block;
  font-size: 0.86rem;
  overflow-wrap: anywhere;
}
.head__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
}
.stats dt {
  font-size: 0.72rem;
  color: var(--text-3);
}
.stats dd {
  margin: 2px 0 0;
  font-weight: 700;
  font-size: 0.92rem;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}
.block__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 700;
}
.block__title svg {
  width: 17px;
  height: 17px;
  color: var(--primary);
}
.grid-2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.grid-2.align-end {
  align-items: end;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.note {
  font-size: 0.84rem;
}
.suspend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.suspend.is-suspended {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
  background: var(--danger-soft);
}
.suspend p {
  font-size: 0.84rem;
  margin-top: 2px;
}
.danger .block__title,
.danger .block__title svg {
  color: var(--danger);
}
.danger p {
  font-size: 0.86rem;
}

@media (min-width: 560px) {
  .grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
