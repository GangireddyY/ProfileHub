<script setup>
import { ref, reactive, computed } from 'vue';
import { Crown, Plus, Pencil, Trash2, Check, X, Users, Save, Star, MoreHorizontal, Eye, EyeOff, Sparkles } from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { toast } from '@/composables/useToast';
import { CURRENCIES } from '@/constants/professions';
import { PLAN_INTERVALS, formatPlanPrice, FREE_LIMITS, PLAN_TOGGLES, MAX_PHOTOS, featureRows } from '@/constants/plans';
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
}

function limitsBody() {
  const l = form.limits;
  return {
    ...l,
    maxActiveListings: l.maxActiveListings == null ? null : Math.max(0, Math.round(Number(l.maxActiveListings) || 0)),
    maxListingPhotos: Math.min(MAX_PHOTOS, Math.max(1, Math.round(Number(l.maxListingPhotos) || 1))),
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
    editorOpen.value = false;
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
  <div class="stack" style="--gap: 14px">
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

    <UiSheet v-model:open="editorOpen" :title="editing ? `Edit ${editing.name}` : 'New plan'" width="520px">
      <form class="stack" style="--gap: 14px" novalidate @submit.prevent="save">
        <UiInput v-model="form.name" label="Plan name" maxlength="60" placeholder="e.g. Pro" :error="errors.name" />
        <UiTextarea v-model="form.description" label="Description" :maxlength="300" :rows="2" placeholder="Who is this plan for?" :error="errors.description" />
        <div class="price-grid">
          <UiSelect v-model="form.currency" label="Currency" :options="CURRENCIES" />
          <UiInput v-model="form.price" label="Price" type="number" min="0" inputmode="numeric" hint="0 makes it free" :error="errors.price" />
          <UiSelect v-model="form.interval" label="Billing period" :options="PLAN_INTERVALS" :error="errors.interval" />
        </div>
        <section class="unlocks">
          <header>
            <strong>What this plan unlocks</strong>
            <p class="muted">These are enforced by the app for every member on this plan.</p>
          </header>
          <div class="limit-grid">
            <div class="stack" style="--gap: 8px">
              <UiInput
                v-model="form.limits.maxActiveListings"
                label="Active listings"
                type="number"
                min="0"
                inputmode="numeric"
                :disabled="unlimitedListings"
                :placeholder="unlimitedListings ? 'Unlimited' : ''"
                :error="errors['limits.maxActiveListings']"
              />
              <UiToggle v-model="unlimitedListings" label="Unlimited" />
            </div>
            <UiInput
              v-model="form.limits.maxListingPhotos"
              label="Photos per listing"
              type="number"
              min="1"
              :max="MAX_PHOTOS"
              inputmode="numeric"
              :hint="`1 to ${MAX_PHOTOS}`"
              :error="errors['limits.maxListingPhotos']"
            />
          </div>
          <UiToggle
            v-for="t in PLAN_TOGGLES"
            :key="t.key"
            v-model="form.limits[t.key]"
            :label="t.label"
            :description="t.description"
          />
        </section>
        <UiTagInput
          v-model="form.features"
          label="Extra highlights (optional)"
          placeholder="e.g. Priority support, then press Enter"
          :max="12"
          :max-length="80"
          :error="errors.features"
        />
        <UiInput v-model="form.sortOrder" label="Display order" type="number" min="0" hint="Lower numbers are shown first" />
        <UiToggle
          v-if="!editing?.isDefault"
          v-model="form.active"
          label="Available for new assignments"
          description="Hidden plans stay on members who already have them."
        />
        <p class="muted preview">Preview: <strong>{{ form.name || 'Plan' }}</strong> · {{ formatPlanPrice(preview) }}</p>
      </form>
      <template #footer>
        <UiButton variant="ghost" @click="editorOpen = false">Cancel</UiButton>
        <UiButton :icon="Save" :loading="saving" @click="save">{{ editing ? 'Save changes' : 'Create plan' }}</UiButton>
      </template>
    </UiSheet>

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
.unlocks {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.unlocks header p {
  font-size: 0.82rem;
}
.limit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}
.price-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.preview {
  font-size: 0.86rem;
}
@media (min-width: 480px) {
  .price-grid {
    grid-template-columns: 110px minmax(0, 1fr) 160px;
  }
}
</style>
