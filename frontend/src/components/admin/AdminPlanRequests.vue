<script setup>
import { ref, watch, onMounted } from 'vue';
import { Crown, Check, X, ArrowRight, Inbox } from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import { formatPlanPrice, formatDate } from '@/constants/plans';
import UiCard from '@/components/ui/UiCard.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';

const emit = defineEmits(['changed']);

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
  { value: 'all', label: 'All' },
];
const STATUS_BADGE = {
  pending: { tone: 'warning', label: 'Pending' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Declined' },
};

const status = ref('pending');
const items = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    items.value = (await api.get('/admin/plan-requests', { params: { status: status.value } })).data.items;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loading.value = false;
  }
}
watch(status, load);
onMounted(load);

const reviewing = ref(null);
const mode = ref('approve');
const note = ref('');
const expires = ref('');
const errors = ref({});
const busy = ref(false);

/** Default expiry shown in the form: one billing period from today, or none for lifetime plans. */
function suggestedExpiry(plan) {
  const months = { month: 1, quarter: 3, year: 12 }[plan?.interval];
  if (!months) return '';
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function openReview(r, kind) {
  reviewing.value = r;
  mode.value = kind;
  note.value = '';
  expires.value = suggestedExpiry(r.plan);
  errors.value = {};
}

async function submit() {
  busy.value = true;
  errors.value = {};
  const r = reviewing.value;
  try {
    if (mode.value === 'approve') {
      await api.post(`/admin/plan-requests/${r.id}/approve`, { note: note.value, expiresAt: expires.value || null });
      toast.success(`${r.requester?.name ?? 'The member'} is now on ${r.plan?.name}`);
    } else {
      await api.post(`/admin/plan-requests/${r.id}/reject`, { note: note.value });
      toast.success('Request declined');
    }
    reviewing.value = null;
    load();
    emit('changed');
  } catch (err) {
    errors.value = fieldErrors(err);
    toast.error(errorMessage(err));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="stack" style="--gap: 14px">
    <div class="segmented" role="tablist">
      <button
        v-for="s in STATUS_TABS"
        :key="s.value"
        type="button"
        role="tab"
        :aria-selected="status === s.value"
        :class="{ 'is-active': status === s.value }"
        @click="status = s.value"
      >
        {{ s.label }}
      </button>
    </div>

    <div v-if="loading" class="stack" style="--gap: 10px">
      <UiSkeleton v-for="i in 3" :key="i" height="110px" />
    </div>

    <UiCard v-else-if="!items.length">
      <UiEmpty
        :icon="Inbox"
        :title="status === 'pending' ? 'No plan requests waiting' : 'Nothing here'"
        description="When members ask to move to another plan from their Plans page, their requests show up here."
      />
    </UiCard>

    <TransitionGroup v-else name="list" tag="div" class="list">
      <UiCard v-for="r in items" :key="r.id" class="req">
        <div class="req__main">
          <RouterLink v-if="r.requester" :to="`/u/${r.requester.id}`">
            <UiAvatar :name="r.requester.name" :src="r.requester.avatarUrl" :size="44" />
          </RouterLink>
          <div class="grow" style="min-width: 0">
            <div class="req__top">
              <strong>{{ r.requester?.name ?? 'Deleted member' }}</strong>
              <UiBadge :tone="STATUS_BADGE[r.status].tone">{{ STATUS_BADGE[r.status].label }}</UiBadge>
            </div>
            <span v-if="r.requester" class="subtle req__email">{{ r.requester.email }}</span>
            <div class="req__plans">
              <span class="chip">{{ r.requester?.currentPlan?.name ?? 'No plan' }}</span>
              <ArrowRight />
              <span class="chip chip--to"><Crown /> {{ r.plan?.name }} · {{ formatPlanPrice(r.plan) }}</span>
            </div>
            <p v-if="r.message" class="req__message">“{{ r.message }}”</p>
            <p class="subtle req__meta">
              Asked {{ timeAgo(r.createdAt) }}
              <template v-if="r.reviewer"> · {{ STATUS_BADGE[r.status].label.toLowerCase() }} by {{ r.reviewer.name }} {{ timeAgo(r.reviewedAt) }}</template>
              <template v-if="r.status === 'approved' && r.requester?.planExpiresAt"> · until {{ formatDate(r.requester.planExpiresAt) }}</template>
            </p>
            <p v-if="r.reviewNote" class="req__note">Note: “{{ r.reviewNote }}”</p>
          </div>
        </div>
        <div v-if="r.status === 'pending'" class="req__actions">
          <UiButton variant="ghost" size="sm" :icon="X" @click="openReview(r, 'reject')">Decline</UiButton>
          <UiButton size="sm" :icon="Check" @click="openReview(r, 'approve')">Approve</UiButton>
        </div>
      </UiCard>
    </TransitionGroup>

    <UiSheet
      :open="Boolean(reviewing)"
      :title="mode === 'approve' ? 'Approve plan request' : 'Decline plan request'"
      width="460px"
      @update:open="(v) => !v && (reviewing = null)"
    >
      <div v-if="reviewing" class="stack" style="--gap: 14px">
        <p>
          <strong>{{ reviewing.requester?.name }}</strong>
          {{ mode === 'approve' ? 'will be moved to' : 'asked for' }}
          <strong>{{ reviewing.plan?.name }}</strong> ({{ formatPlanPrice(reviewing.plan) }}).
        </p>
        <UiInput
          v-if="mode === 'approve'"
          v-model="expires"
          type="date"
          label="Plan ends on"
          hint="Leave empty for no end date. When it ends, the member goes back to the default plan."
          :error="errors.expiresAt"
        />
        <UiTextarea
          v-model="note"
          :label="mode === 'approve' ? 'Note to the member (optional)' : 'Reason (optional, shown to the member)'"
          :maxlength="300"
          :rows="3"
          :error="errors.note"
        />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="reviewing = null">Cancel</UiButton>
        <UiButton :variant="mode === 'approve' ? 'primary' : 'danger'" :loading="busy" @click="submit">
          {{ mode === 'approve' ? 'Approve and switch plan' : 'Decline request' }}
        </UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  align-self: flex-start;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius);
  background: var(--surface-3);
}
.segmented button {
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.86rem;
}
.segmented button.is-active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-xs);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.req {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.req__main {
  flex: 1;
  min-width: 260px;
  display: flex;
  gap: 12px;
}
.req__top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.req__email {
  display: block;
  font-size: 0.8rem;
}
.req__plans {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.req__plans > svg {
  width: 16px;
  height: 16px;
  color: var(--text-3);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--surface-3);
  font-size: 0.82rem;
  font-weight: 600;
}
.chip--to {
  background: var(--warning-soft);
  color: color-mix(in srgb, var(--warning) 70%, var(--text));
}
.chip svg {
  width: 14px;
  height: 14px;
}
.req__message {
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--text-2);
}
.req__meta {
  margin-top: 6px;
  font-size: 0.8rem;
}
.req__note {
  margin-top: 4px;
  font-size: 0.84rem;
  color: var(--text-2);
}
.req__actions {
  display: flex;
  gap: 8px;
}
</style>
