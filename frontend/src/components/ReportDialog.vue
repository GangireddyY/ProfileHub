<script setup>
import { ref, computed, watch } from 'vue';
import { Flag } from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { toast } from '@/composables/useToast';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';

/** Send a report about a profile, listing or conversation to the admins. */
const open = defineModel('open', { type: Boolean, default: false });
const props = defineProps({
  /** 'user' | 'listing' | 'conversation' | 'review' */
  targetType: { type: String, required: true },
  /** User id for profiles and conversations, listing id for listings, review id for reviews. */
  targetId: { type: String, required: true },
  /** Shown in the title, e.g. the member's name or listing title. */
  targetLabel: { type: String, default: '' },
});

const REASONS = [
  { value: 'spam', label: 'Spam or unwanted promotion' },
  { value: 'scam', label: 'Scam, fraud or asking for money / OTP' },
  { value: 'harassment', label: 'Harassment, threats or hate' },
  { value: 'fake', label: 'Fake profile or impersonation' },
  { value: 'misuse', label: 'Misusing my contact details or photos' },
  { value: 'prohibited', label: 'Prohibited or illegal item / service' },
  { value: 'inappropriate', label: 'Sexual or inappropriate content' },
  { value: 'other', label: 'Something else' },
];

const reason = ref('');
const details = ref('');
const errors = ref({});
const sending = ref(false);

const title = computed(() => {
  const what = { user: 'profile', listing: 'listing', conversation: 'conversation', review: 'review' }[props.targetType];
  return props.targetLabel ? `Report ${props.targetLabel}` : `Report this ${what}`;
});

watch(open, (isOpen) => {
  if (!isOpen) return;
  reason.value = '';
  details.value = '';
  errors.value = {};
});

async function submit() {
  if (!reason.value) {
    errors.value = { reason: 'Pick a reason' };
    return;
  }
  sending.value = true;
  errors.value = {};
  try {
    await api.post('/reports', { targetType: props.targetType, targetId: props.targetId, reason: reason.value, details: details.value });
    open.value = false;
    toast.success("Thanks for letting us know. An admin will review it; the member isn't told who reported them.", {
      title: 'Report sent',
    });
  } catch (err) {
    errors.value = fieldErrors(err);
    toast.error(errorMessage(err));
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <UiSheet v-model:open="open" :title="title" width="480px">
    <div class="stack" style="--gap: 14px">
      <p class="muted">Reports are private. If someone is in immediate danger, contact the police first.</p>
      <fieldset class="reasons">
        <legend class="field__label">What's wrong?</legend>
        <label v-for="r in REASONS" :key="r.value" class="reason" :class="{ 'is-active': reason === r.value }">
          <input v-model="reason" type="radio" name="report-reason" :value="r.value" />
          <span>{{ r.label }}</span>
        </label>
        <p v-if="errors.reason" class="field__msg field__msg--error">{{ errors.reason }}</p>
      </fieldset>
      <UiTextarea
        v-model="details"
        label="Details (optional)"
        :maxlength="1000"
        :rows="4"
        placeholder="What happened? Include dates or message text if it helps."
        :error="errors.details"
      />
    </div>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">Cancel</UiButton>
      <UiButton variant="danger" :icon="Flag" :loading="sending" @click="submit">Send report</UiButton>
    </template>
  </UiSheet>
</template>

<style scoped>
.reasons {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}
.reason {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.9rem;
  cursor: pointer;
}
.reason:hover {
  border-color: var(--border-strong);
}
.reason.is-active {
  border-color: var(--danger);
  background: var(--danger-soft);
}
.reason input {
  accent-color: var(--danger);
}
</style>
