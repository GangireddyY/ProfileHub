<script setup>
import { ref, reactive, computed } from 'vue';
import {
  Crown,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Users,
  Save,
  Star,
  MoreHorizontal,
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
  FileText,
  IndianRupee,
  SlidersHorizontal,
  ToggleRight,
  ListPlus,
  Store,
  Images,
  ImagePlus,
  UserPlus,
  MessageCircle,
  MessagesSquare,
  TrendingUp,
  BadgeCheck,
  Contact,
  Mail,
  BellRing,
} from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { toast } from '@/composables/useToast';
import { CURRENCIES } from '@/constants/professions';
import { PLAN_INTERVALS, formatPlanPrice, FREE_LIMITS, PLAN_TOGGLES, MAX_PHOTOS, MAX_CHAT_PHOTOS, featureRows } from '@/constants/plans';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiToggle from '@/components/ui/UiToggle.vue';
import UiTagInput from '@/components/ui/UiTagInput.vue';
import UiDropdown from '@/components/ui/UiDropdown.vue';

/** Accent colour per plan card, in display order (e.g. Free, Pro, Business). */
const ACCENTS = ['#64748b', 'var(--primary)', '#f59e0b', '#10b981', '#ec4899'];

const props = defineProps({
  plans: { type: Array, required: true },
  loading: Boolean,
});
const emit = defineEmits(['changed']);

const EMPTY = {
  name: '',
  description: '',
  price: 0,
  currency: 'INR',
  interval: 'month',
  features: [],
  limits: { ...FREE_LIMITS },
  active: true,
  sortOrder: 0,
};
const editorOpen = ref(false);
const editing = ref(null);
const form = reactive({ ...EMPTY });
const errors = ref({});
const saving = ref(false);

const preview = computed(() => ({ ...form, price: Number(form.price) || 0 }));

const unlimitedListings = computed({
  get: () => form.limits.maxActiveListings == null,
  set: (on) => (form.limits.maxActiveListings = on ? null : FREE_LIMITS.maxActiveListings),
});
const unlimitedInvites = computed({
  get: () => form.limits.maxDailyInvites == null,
  set: (on) => (form.limits.maxDailyInvites = on ? null : FREE_LIMITS.maxDailyInvites),
});

function openEditor(plan = null) {
  editing.value = plan;
  Object.assign(
    form,
    plan
      ? { ...EMPTY, ...plan, features: [...(plan.features || [])], limits: { ...FREE_LIMITS, ...plan.limits } }
      : { ...EMPTY, limits: { ...FREE_LIMITS }, sortOrder: props.plans.length },
  );
  errors.value = {};
  editorOpen.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeEditor() {
  editorOpen.value = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const accentFor = (plan) => {
  const i = props.plans.findIndex((p) => p.id === plan?.id);
  return ACCENTS[(i === -1 ? props.plans.length : i) % ACCENTS.length];
};

const TOGGLE_ICONS = {
  messaging: MessagesSquare,
  messageAnyone: MessageCircle,
  priorityInDiscover: TrendingUp,
  verifiedBadge: BadgeCheck,
  featuredListings: Sparkles,
  showContactPublicly: Contact,
  emailAlerts: Mail,
  pushAlerts: BellRing,
};
const enabledCount = computed(() => PLAN_TOGGLES.filter((t) => form.limits[t.key]).length);

function limitsBody() {
  const l = form.limits;
  return {
    ...l,
    maxActiveListings: l.maxActiveListings == null ? null : Math.max(0, Math.round(Number(l.maxActiveListings) || 0)),
    maxListingPhotos: Math.min(MAX_PHOTOS, Math.max(1, Math.round(Number(l.maxListingPhotos) || 1))),
    maxChatPhotos: Math.min(MAX_CHAT_PHOTOS, Math.max(0, Math.round(Number(l.maxChatPhotos) || 0))),
    maxDailyInvites: l.maxDailyInvites == null ? null : Math.max(1, Math.round(Number(l.maxDailyInvites) || 1)),
  };
}

async function save() {
  saving.value = true;
  errors.value = {};
  const body = {
    name: form.name.trim(),
    description: form.description.trim(),
    price: Number(form.price) || 0,
    currency: form.currency,
    interval: form.interval,
    features: form.features,
    limits: limitsBody(),
    active: form.active,
    sortOrder: Number(form.sortOrder) || 0,
  };
  try {
    if (editing.value) await api.patch(`/admin/plans/${editing.value.id}`, body);
    else await api.post('/admin/plans', body);
    toast.success(editing.value ? `“${body.name}” updated` : `“${body.name}” created`);
    closeEditor();
    emit('changed');
  } catch (err) {
    errors.value = fieldErrors(err);
    toast.error(errorMessage(err));
  } finally {
    saving.value = false;
  }
}

const deleting = ref(null);
const busyDelete = ref(false);
async function remove() {
  busyDelete.value = true;
  try {
    await api.delete(`/admin/plans/${deleting.value.id}`);
    toast.success(`“${deleting.value.name}” deleted`);
    deleting.value = null;
    emit('changed');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busyDelete.value = false;
  }
}

async function makeDefault(plan) {
  try {
    await api.patch(`/admin/plans/${plan.id}`, { isDefault: true });
    toast.success(`“${plan.name}” is now the default plan for new members and expired plans`);
    emit('changed');
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

async function toggleActive(plan) {
  try {
    await api.patch(`/admin/plans/${plan.id}`, { active: !plan.active });
    toast.success(plan.active ? `“${plan.name}” is hidden from new assignments` : `“${plan.name}” is available again`);
    emit('changed');
  } catch (err) {
    toast.error(errorMessage(err));
  }
}
</script>

<template>
  <!-- ---------- Plan editor page ---------- -->
  <form v-if="editorOpen" class="editor" novalidate @submit.prevent="save">
    <header class="editor__bar">
      <UiButton variant="ghost" size="sm" :icon="ArrowLeft" @click="closeEditor">All plans</UiButton>
      <div class="editor__title">
        <h2>{{ editing ? `Edit ${editing.name}` : 'New plan' }}</h2>
        <p class="muted">Changes apply to every member on this plan as soon as you save.</p>
      </div>
      <div class="editor__actions">
        <UiButton variant="secondary" @click="closeEditor">Cancel</UiButton>
        <UiButton type="submit" :icon="Save" :loading="saving">{{ editing ? 'Save changes' : 'Create plan' }}</UiButton>
      </div>
    </header>

    <div class="editor__layout">
      <div class="editor__main">
        <!-- Basics -->
        <UiCard class="esec">
          <header class="esec__head">
            <span class="esec__icon"><FileText /></span>
            <div>
              <h3>Basics</h3>
              <p class="muted">The name and description members see on the Plans page.</p>
            </div>
          </header>
          <div class="egrid egrid--2">
            <UiInput v-model="form.name" label="Plan name" maxlength="60" placeholder="e.g. Pro" :error="errors.name" />
            <UiInput v-model="form.sortOrder" label="Display order" type="number" min="0" hint="Lower numbers are shown first" />
            <UiTextarea
              v-model="form.description"
              class="span-2"
              label="Description"
              :maxlength="300"
              :rows="3"
              placeholder="Who is this plan for?"
              :error="errors.description"
            />
          </div>
          <UiToggle
            v-if="!editing?.isDefault"
            v-model="form.active"
            class="etoggle"
            :icon="Eye"
            label="Available for new assignments"
            description="Hidden plans stay on members who already have them."
          />
        </UiCard>

        <!-- Pricing -->
        <UiCard class="esec">
          <header class="esec__head">
            <span class="esec__icon"><IndianRupee /></span>
            <div>
              <h3>Pricing</h3>
              <p class="muted">Shown on the plan card. A price of 0 makes the plan free.</p>
            </div>
          </header>
          <div class="egrid egrid--3">
            <UiSelect v-model="form.currency" label="Currency" :options="CURRENCIES" />
            <UiInput v-model="form.price" label="Price" type="number" min="0" inputmode="numeric" :error="errors.price" />
            <UiSelect v-model="form.interval" label="Billing period" :options="PLAN_INTERVALS" :error="errors.interval" />
          </div>
        </UiCard>

        <!-- Limits -->
        <UiCard class="esec">
          <header class="esec__head">
            <span class="esec__icon"><SlidersHorizontal /></span>
            <div>
              <h3>Limits</h3>
              <p class="muted">How much members on this plan can use. The app enforces these.</p>
            </div>
          </header>
          <div class="limits">
            <div class="ltile">
              <div class="ltile__head"><Store /> <strong>Active listings</strong></div>
              <UiInput
                v-model="form.limits.maxActiveListings"
                type="number"
                min="0"
                inputmode="numeric"
                aria-label="Active listings"
                :disabled="unlimitedListings"
                :placeholder="unlimitedListings ? 'Unlimited' : ''"
                :error="errors['limits.maxActiveListings']"
              />
              <UiToggle v-model="unlimitedListings" label="Unlimited" class="ltile__foot" />
            </div>
            <div class="ltile">
              <div class="ltile__head"><Images /> <strong>Photos per listing</strong></div>
              <UiInput
                v-model="form.limits.maxListingPhotos"
                type="number"
                min="1"
                :max="MAX_PHOTOS"
                inputmode="numeric"
                aria-label="Photos per listing"
                :error="errors['limits.maxListingPhotos']"
              />
              <p class="ltile__foot subtle">From 1 to {{ MAX_PHOTOS }}</p>
            </div>
            <div class="ltile">
              <div class="ltile__head"><ImagePlus /> <strong>Photos per chat message</strong></div>
              <UiInput
                v-model="form.limits.maxChatPhotos"
                type="number"
                min="0"
                :max="MAX_CHAT_PHOTOS"
                inputmode="numeric"
                aria-label="Photos per chat message"
                :error="errors['limits.maxChatPhotos']"
              />
              <p class="ltile__foot subtle">0 turns chat photos off · up to {{ MAX_CHAT_PHOTOS }}</p>
            </div>
            <div class="ltile">
              <div class="ltile__head"><UserPlus /> <strong>Invitations per day</strong></div>
              <UiInput
                v-model="form.limits.maxDailyInvites"
                type="number"
                min="1"
                inputmode="numeric"
                aria-label="Invitations per day"
                :disabled="unlimitedInvites"
                :placeholder="unlimitedInvites ? 'Unlimited' : ''"
                :error="errors['limits.maxDailyInvites']"
              />
              <UiToggle v-model="unlimitedInvites" label="Unlimited" class="ltile__foot" />
            </div>
          </div>
        </UiCard>

        <!-- Features -->
        <UiCard class="esec">
          <header class="esec__head">
            <span class="esec__icon"><ToggleRight /></span>
            <div class="grow">
              <h3>Features</h3>
              <p class="muted">Switch on what this plan includes.</p>
            </div>
            <UiBadge tone="primary">{{ enabledCount }} of {{ PLAN_TOGGLES.length }} on</UiBadge>
          </header>
          <div class="ftiles">
            <UiToggle
              v-for="tg in PLAN_TOGGLES"
              :key="tg.key"
              v-model="form.limits[tg.key]"
              class="ftile"
              :class="{ 'is-on': form.limits[tg.key] }"
              :icon="TOGGLE_ICONS[tg.key]"
              :label="tg.label"
              :description="tg.description"
              :disabled="Boolean(tg.requires && !form.limits[tg.requires])"
            />
          </div>
        </UiCard>

        <!-- Highlights -->
        <UiCard class="esec">
          <header class="esec__head">
            <span class="esec__icon"><ListPlus /></span>
            <div>
              <h3>Extra highlights</h3>
              <p class="muted">Optional selling points shown on the plan card, like “Priority support”.</p>
            </div>
          </header>
          <UiTagInput
            v-model="form.features"
            placeholder="Type a highlight and press Enter"
            :max="12"
            :max-length="80"
            :error="errors.features"
          />
        </UiCard>
      </div>

      <!-- Live preview -->
      <aside class="editor__aside">
        <p class="aside__label">Live preview</p>
        <UiCard :padded="false" class="plan plan--preview" :style="{ '--accent': accentFor(editing) }">
          <div class="plan__body">
            <header class="plan__head">
              <span class="plan__icon"><Crown /></span>
              <strong class="plan__name">{{ form.name || 'Plan name' }}</strong>
              <UiBadge v-if="editing?.isDefault" tone="success" :icon="Star">Default</UiBadge>
            </header>
            <div class="plan__price">{{ formatPlanPrice(preview) }}</div>
            <p v-if="form.description" class="plan__desc">{{ form.description }}</p>
            <ul class="plan__features">
              <li v-for="row in featureRows(limitsBody())" :key="row.key" :class="{ 'is-off': !row.included }">
                <Check v-if="row.included" /><X v-else /> <span>{{ row.label }}</span>
              </li>
              <li v-for="f in form.features" :key="f" class="is-extra"><Sparkles /> <span>{{ f }}</span></li>
            </ul>
          </div>
          <footer v-if="editing" class="plan__foot">
            <span class="plan__members">
              <Users /> <strong>{{ editing.subscriberCount }}</strong> {{ editing.subscriberCount === 1 ? 'member' : 'members' }}
            </span>
          </footer>
        </UiCard>
      </aside>
    </div>
  </form>

  <div v-else class="stack" style="--gap: 14px">
    <div class="row-between">
      <p class="muted">
        Every member is on the default plan unless an admin assigns another one, from the Users tab or by approving a plan request.
      </p>
      <UiButton size="sm" :icon="Plus" @click="openEditor()">New plan</UiButton>
    </div>

    <UiCard v-if="!loading && !plans.length">
      <UiEmpty :icon="Crown" title="No plans yet" description="Add plans like Free, Pro or Business with a price, billing period and features.">
        <UiButton :icon="Plus" @click="openEditor()">Create your first plan</UiButton>
      </UiEmpty>
    </UiCard>

    <div v-else class="plans">
      <UiCard
        v-for="(p, i) in plans"
        :key="p.id"
        :padded="false"
        class="plan"
        :class="{ 'is-hidden': !p.active }"
        :style="{ '--accent': ACCENTS[i % ACCENTS.length] }"
      >
        <div class="plan__body">
          <header class="plan__head">
            <span class="plan__icon"><Crown /></span>
            <strong class="plan__name">{{ p.name }}</strong>
            <UiBadge v-if="p.isDefault" tone="success" :icon="Star">Default</UiBadge>
            <UiBadge v-else-if="!p.active" tone="neutral" :icon="EyeOff">Hidden</UiBadge>
          </header>
          <div class="plan__price">{{ formatPlanPrice(p) }}</div>
          <p v-if="p.description" class="plan__desc">{{ p.description }}</p>

          <ul class="plan__features">
            <li v-for="row in featureRows(p.limits)" :key="row.key" :class="{ 'is-off': !row.included }">
              <Check v-if="row.included" /><X v-else /> <span>{{ row.label }}</span>
            </li>
            <li v-for="f in p.features" :key="f" class="is-extra"><Sparkles /> <span>{{ f }}</span></li>
          </ul>
        </div>

        <footer class="plan__foot">
          <span class="plan__members">
            <Users /> <strong>{{ p.subscriberCount }}</strong> {{ p.subscriberCount === 1 ? 'member' : 'members' }}
          </span>
          <div class="plan__actions">
            <UiButton variant="secondary" size="sm" :icon="Pencil" @click="openEditor(p)">Edit</UiButton>
            <UiDropdown v-if="!p.isDefault">
              <template #trigger="{ toggle }">
                <UiButton variant="ghost" size="sm" :icon="MoreHorizontal" icon-only aria-label="More plan actions" @click="toggle" />
              </template>
              <button v-if="p.active" type="button" class="menu-item" @click="makeDefault(p)"><Star /> Make default</button>
              <button type="button" class="menu-item" @click="toggleActive(p)">
                <component :is="p.active ? EyeOff : Eye" /> {{ p.active ? 'Hide from members' : 'Show to members' }}
              </button>
              <div class="menu-sep" />
              <button type="button" class="menu-item menu-item--danger" @click="deleting = p"><Trash2 /> Delete plan</button>
            </UiDropdown>
          </div>
        </footer>
      </UiCard>
    </div>

    <UiSheet :open="Boolean(deleting)" title="Delete plan" width="440px" @update:open="(v) => !v && (deleting = null)">
      <p v-if="deleting">
        Delete <strong>{{ deleting.name }}</strong>?
        <template v-if="deleting.subscriberCount">
          {{ deleting.subscriberCount }} {{ deleting.subscriberCount === 1 ? 'member loses' : 'members lose' }} this plan.
        </template>
        This cannot be undone.
      </p>
      <template #footer>
        <UiButton variant="ghost" @click="deleting = null">Cancel</UiButton>
        <UiButton variant="danger" :icon="Trash2" :loading="busyDelete" @click="remove">Delete plan</UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.plans {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  align-items: stretch;
}
/* `.plans .plan` outranks the card's own border; no overflow clipping so the actions menu can open. */
.plans .plan {
  --accent: var(--primary);
  display: flex;
  flex-direction: column;
  border-top: 4px solid var(--accent);
  transition: box-shadow 0.2s var(--ease);
}
.plans .plan:hover {
  box-shadow: var(--shadow);
}
.plans .plan.is-hidden {
  opacity: 0.65;
}
.plan__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 18px 14px;
}
.plan__head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.plan__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}
.plan__icon svg {
  width: 18px;
  height: 18px;
}
.plan__name {
  flex: 1;
  min-width: 0;
  font-size: 1.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plan__price {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text);
}
.plan__desc {
  font-size: 0.86rem;
  color: var(--text-2);
}
.plan__features {
  list-style: none;
  margin: 4px 0 0;
  padding: 12px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px dashed var(--border);
  font-size: 0.87rem;
}
.plan__features li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.plan__features svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--success);
}
.plan__features li.is-off {
  color: var(--text-3);
}
.plan__features li.is-off svg {
  color: var(--text-3);
  opacity: 0.7;
}
.plan__features li.is-extra svg {
  color: var(--accent);
}
.plan__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px 10px 18px;
  border-top: 1px solid var(--border);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  background: var(--surface-2);
}
.plan__members {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.84rem;
  color: var(--text-2);
  white-space: nowrap;
}
.plan__members svg {
  width: 15px;
  height: 15px;
  color: var(--text-3);
}
.plan__members strong {
  color: var(--text);
}
.plan__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
/* ---------- Editor page ---------- */
.editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.editor__bar {
  position: sticky;
  top: var(--nav-h);
  z-index: 15;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 16px;
  padding: 12px 14px;
  border-radius: var(--radius-lg, 16px);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
}
.editor__title {
  flex: 1;
  min-width: 200px;
}
.editor__title h2 {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.editor__title p {
  font-size: 0.82rem;
}
.editor__actions {
  display: flex;
  gap: 8px;
}
.editor__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}
.editor__main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.esec {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.esec__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.esec__head h3 {
  font-size: 1rem;
  font-weight: 700;
}
.esec__head p {
  font-size: 0.84rem;
  margin-top: 1px;
}
.esec__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--primary-soft);
  color: var(--primary);
}
.esec__icon svg {
  width: 18px;
  height: 18px;
}
.egrid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.span-2 {
  grid-column: 1 / -1;
}
.etoggle {
  padding: 12px 14px !important;
  border-radius: var(--radius);
  background: var(--surface-2);
}

/* Limit tiles: same height, input in the middle, helper or "Unlimited" switch aligned at the bottom. */
.limits {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.ltile {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.ltile__head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
}
.ltile__head svg {
  width: 17px;
  height: 17px;
  color: var(--primary);
  flex-shrink: 0;
}
.ltile__foot {
  margin-top: auto;
  min-height: 28px;
  font-size: 0.78rem;
  display: flex;
  align-items: center;
}

/* Feature tiles */
.ftiles {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}
.ftile {
  padding: 12px 14px !important;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  align-items: flex-start !important;
  transition: border-color 0.15s var(--ease), background-color 0.15s var(--ease);
}
.ftile.is-on {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background: var(--primary-soft);
}

/* Live preview */
.editor__aside {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.aside__label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
}
.plan--preview {
  --accent: var(--primary);
  display: flex;
  flex-direction: column;
  border-top: 4px solid var(--accent) !important;
  box-shadow: var(--shadow);
}

@media (min-width: 640px) {
  .egrid--2 {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  }
  .egrid--3 {
    grid-template-columns: 140px minmax(0, 1fr) minmax(0, 1fr);
  }
  .limits,
  .ftiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1180px) {
  .editor__layout {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
  .editor__aside {
    position: sticky;
    top: calc(var(--nav-h) + 90px);
  }
}
@media (max-width: 559px) {
  .editor__actions {
    width: 100%;
  }
  .editor__actions > * {
    flex: 1;
  }
}
</style>
