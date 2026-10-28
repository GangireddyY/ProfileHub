<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Crown, Check, Minus, Send, Hourglass, CircleCheck, CircleX, X, Sparkles } from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useRealtimeStore } from '@/stores/realtime';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import { formatPlanPrice, formatDate, featureRows } from '@/constants/plans';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import BackButton from '@/components/BackButton.vue';

const auth = useAuthStore();
const realtime = useRealtimeStore();

const plans = ref([]);
const requests = ref([]);
const currentPlanId = ref(null);
const planExpiresAt = ref(null);
const loading = ref(true);

async function load() {
  try {
    const { data } = await api.get('/plans');
    plans.value = data.plans;
    requests.value = data.requests;
    currentPlanId.value = data.currentPlanId;
    planExpiresAt.value = data.planExpiresAt;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loading.value = false;
  }
}
onMounted(load);
// An admin's decision arrives as a notification; refresh so the page shows the new plan right away.
watch(() => auth.user?.planId, load);
watch(() => realtime.networkVersion, load);

const current = computed(() => plans.value.find((p) => p.id === currentPlanId.value) || auth.user?.plan || null);
const pending = computed(() => requests.value.find((r) => r.status === 'pending') || null);
const history = computed(() => requests.value.filter((r) => r.status !== 'pending'));

const STATUS = {
  pending: { label: 'Waiting for review', tone: 'warning', icon: Hourglass },
  approved: { label: 'Approved', tone: 'success', icon: CircleCheck },
  rejected: { label: 'Declined', tone: 'danger', icon: CircleX },
};

const sheetOpen = ref(false);
const picked = ref(null);
const message = ref('');
const errors = ref({});
const sending = ref(false);

function ask(plan) {
  picked.value = plan;
  message.value = '';
  errors.value = {};
  sheetOpen.value = true;
}

async function send() {
  sending.value = true;
  errors.value = {};
  try {
    const { data } = await api.post('/plans/requests', { planId: picked.value.id, message: message.value });
    requests.value = [data.request, ...requests.value];
    sheetOpen.value = false;
    toast.success(`Your request for ${picked.value.name} was sent to the admins. You'll get a notification when it's reviewed.`, {
      title: 'Request sent',
    });
  } catch (err) {
    errors.value = fieldErrors(err);
    toast.error(errorMessage(err));
  } finally {
    sending.value = false;
  }
}

const cancelling = ref(false);
async function cancel() {
  cancelling.value = true;
  try {
    const { data } = await api.delete(`/plans/requests/${pending.value.id}`);
    requests.value = data.requests;
    toast.success('Request cancelled');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    cancelling.value = false;
  }
}
</script>

<template>
  <div class="container plans-page">
    <BackButton />
    <header class="page-head">
      <div>
        <h1 class="page-title">Plans</h1>
        <p class="muted">Every member starts on the free plan. Want more? Request an upgrade and an admin will set it up for you.</p>
      </div>
    </header>

    <UiCard v-if="current" class="current">
      <span class="current__icon"><Crown /></span>
      <div class="grow">
        <span class="subtle current__label">Your plan</span>
        <strong class="current__name">{{ current.name }}</strong>
        <span class="muted">
          {{ formatPlanPrice(current) }}
          <template v-if="planExpiresAt"> · renews or ends on {{ formatDate(planExpiresAt) }}, then back to the free plan</template>
          <template v-else-if="current.price"> · no end date</template>
        </span>
      </div>
    </UiCard>

    <div v-if="pending" class="pending" role="status">
      <Hourglass />
      <div class="grow">
        <strong>Your request for {{ pending.plan?.name }} is waiting for an admin</strong>
        <p class="muted">Sent {{ timeAgo(pending.createdAt) }}<template v-if="pending.message">: “{{ pending.message }}”</template></p>
      </div>
      <UiButton variant="ghost" size="sm" :icon="X" :loading="cancelling" @click="cancel">Cancel request</UiButton>
    </div>

    <div v-if="loading" class="grid">
      <UiSkeleton v-for="i in 3" :key="i" height="320px" />
    </div>

    <div v-else class="grid">
      <UiCard v-for="p in plans" :key="p.id" class="plan" :class="{ 'is-current': p.id === currentPlanId }">
        <header class="plan__head">
          <strong class="plan__name">{{ p.name }}</strong>
          <UiBadge v-if="p.id === currentPlanId" tone="success" :icon="Check">Current plan</UiBadge>
          <UiBadge v-else-if="p.isDefault" tone="neutral">Default</UiBadge>
        </header>
        <span class="plan__price">{{ formatPlanPrice(p) }}</span>
        <p v-if="p.description" class="muted plan__desc">{{ p.description }}</p>
        <ul class="plan__features">
          <li v-for="row in featureRows(p.limits)" :key="row.key" :class="{ 'is-off': !row.included }">
            <Check v-if="row.included" /><Minus v-else /> {{ row.label }}
          </li>
          <li v-for="f in p.features" :key="f" class="is-extra"><Check /> {{ f }}</li>
        </ul>
        <footer class="plan__foot">
          <UiButton v-if="p.id === currentPlanId" variant="secondary" block disabled>You're on this plan</UiButton>
          <UiButton v-else-if="pending?.planId === p.id" variant="secondary" block :icon="Hourglass" disabled>Requested</UiButton>
          <UiButton
            v-else
            block
            :variant="p.isDefault ? 'secondary' : 'primary'"
            :icon="p.isDefault ? undefined : Sparkles"
            :disabled="Boolean(pending)"
            @click="ask(p)"
          >
            {{ p.isDefault ? `Switch to ${p.name}` : `Request ${p.name}` }}
          </UiButton>
        </footer>
      </UiCard>
    </div>
    <p v-if="pending && !loading" class="subtle hint">You can have one request at a time. Cancel it to ask for a different plan.</p>

    <section v-if="history.length" class="history">
      <h2 class="section-title">Your past requests</h2>
      <UiCard :padded="false">
        <ul class="history__list">
          <li v-for="r in history" :key="r.id">
            <component :is="STATUS[r.status].icon" class="history__icon" :class="`is-${r.status}`" />
            <div class="grow">
              <strong>{{ r.plan?.name || 'Plan' }}</strong>
              <span class="muted"> · {{ STATUS[r.status].label }} {{ timeAgo(r.reviewedAt || r.createdAt) }}</span>
              <p v-if="r.reviewNote" class="history__note">Admin: “{{ r.reviewNote }}”</p>
            </div>
          </li>
        </ul>
      </UiCard>
    </section>

    <UiSheet v-model:open="sheetOpen" :title="picked ? `Request the ${picked.name} plan` : 'Request a plan'" width="480px">
      <div v-if="picked" class="stack" style="--gap: 14px">
        <div class="ask">
          <Crown />
          <div>
            <strong>{{ picked.name }}</strong>
            <span class="muted"> · {{ formatPlanPrice(picked) }}</span>
          </div>
        </div>
        <p class="muted">An admin reviews your request and switches your plan. You'll get a notification either way.</p>
        <UiTextarea
          v-model="message"
          label="Message to the admin (optional)"
          :maxlength="500"
          :rows="4"
          placeholder="Why you need this plan, or how you'd like to pay"
          :error="errors.message"
        />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="sheetOpen = false">Cancel</UiButton>
        <UiButton :icon="Send" :loading="sending" @click="send">Send request</UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.plans-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.current {
  display: flex;
  align-items: center;
  gap: 14px;
  border-color: color-mix(in srgb, var(--warning) 35%, var(--border));
}
.current__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: var(--radius);
  background: var(--warning-soft);
  color: var(--warning);
}
.current__icon svg {
  width: 22px;
  height: 22px;
}
.current__label {
  display: block;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.current__name {
  display: block;
  font-size: 1.2rem;
}
.pending {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, var(--border));
  background: var(--warning-soft);
}
.pending > svg {
  width: 20px;
  height: 20px;
  color: var(--warning);
}
.pending p {
  font-size: 0.86rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.plan {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.plan.is-current {
  border-color: var(--success);
  box-shadow: 0 0 0 3px var(--success-soft);
}
.plan__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.plan__name {
  font-size: 1.15rem;
}
.plan__price {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--primary);
}
.plan__desc {
  font-size: 0.88rem;
}
.plan__features {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.9rem;
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
  margin-top: 3px;
  color: var(--success);
}
.plan__features li.is-off {
  color: var(--text-3);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--text-3) 50%, transparent);
}
.plan__features li.is-off svg {
  color: var(--text-3);
}
.plan__features li.is-extra svg {
  color: var(--primary);
}
.plan__foot {
  margin-top: auto;
  padding-top: 12px;
}
.hint {
  font-size: 0.84rem;
}
.history {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.history__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.history__list li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  font-size: 0.9rem;
}
.history__list li:first-child {
  border-top: 0;
}
.history__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 2px;
}
.history__icon.is-approved {
  color: var(--success);
}
.history__icon.is-rejected {
  color: var(--danger);
}
.history__note {
  margin-top: 2px;
  font-size: 0.84rem;
  color: var(--text-2);
}
.ask {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--surface-2);
}
.ask svg {
  width: 20px;
  height: 20px;
  color: var(--warning);
}
</style>
