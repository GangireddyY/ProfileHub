<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Flag, Check, X, UserRound, Store, MessagesSquare, Inbox, Settings2, RotateCcw, Star, Trash2 } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import AdminUserSheet from './AdminUserSheet.vue';

/** Reports from members about profiles, listings and conversations. */
const props = defineProps({ plans: { type: Array, default: () => [] } });
const emit = defineEmits(['changed']);

const { t } = useI18n();
const tr = (key, params) => t(`admin.reports.${key}`, params ?? {});
const STATUS_TABS = computed(() => ['open', 'resolved', 'dismissed', 'all'].map((value) => ({ value, label: tr(`status.${value}`) })));
const reasonLabel = (reason) => tr(`reason.${reason}`);
const TARGET_ICONS = { user: UserRound, listing: Store, conversation: MessagesSquare, review: Star };
const TARGET = computed(() =>
  Object.fromEntries(Object.entries(TARGET_ICONS).map(([key, icon]) => [key, { icon, label: tr(`target.${key}`) }])),
);
const STATUS_TONE = { open: 'warning', resolved: 'success', dismissed: 'neutral' };

const status = ref('open');
const items = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    items.value = (await api.get('/admin/reports', { params: { status: status.value } })).data.items;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loading.value = false;
  }
}
watch(status, load);
onMounted(load);

const reviewing = ref(null);
const decision = ref('resolved');
const note = ref('');
const busy = ref(false);

function review(r, next) {
  reviewing.value = r;
  decision.value = next;
  note.value = '';
}

async function submit() {
  busy.value = true;
  try {
    await api.patch(`/admin/reports/${reviewing.value.id}`, { status: decision.value, note: note.value });
    toast.success(tr(decision.value === 'resolved' ? 'resolved' : decision.value === 'dismissed' ? 'dismissed' : 'reopened'));
    reviewing.value = null;
    load();
    emit('changed');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = false;
  }
}

// Act on the reported member (suspend, edit, delete) without leaving the queue.
const sheetOpen = ref(false);
const sheetUserId = ref('');
function manage(userId) {
  sheetUserId.value = userId;
  sheetOpen.value = true;
}
function onUserChanged() {
  load();
  emit('changed');
}

async function removeReview(r) {
  const reason = window.prompt(tr('removeReviewPrompt'), r.details ? r.details.slice(0, 300) : '');
  if (reason === null) return;
  try {
    await api.delete(`/admin/reviews/${r.targetId}`, { data: { reason } });
    toast.success(tr('reviewRemoved'));
    load();
    emit('changed');
  } catch (err) {
    toast.error(errorMessage(err));
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
      <UiSkeleton v-for="i in 3" :key="i" height="120px" />
    </div>

    <UiCard v-else-if="!items.length">
      <UiEmpty
        :icon="Inbox"
        :title="status === 'open' ? tr('emptyOpen') : tr('emptyOther')"
        :description="tr('emptyText')"
      />
    </UiCard>

    <TransitionGroup v-else name="list" tag="div" class="list">
      <UiCard v-for="r in items" :key="r.id" class="report">
        <div class="report__main">
          <span class="report__icon"><component :is="TARGET[r.targetType].icon" /></span>
          <div class="grow" style="min-width: 0">
            <div class="report__top">
              <strong>{{ reasonLabel(r.reason) }}</strong>
              <UiBadge :tone="STATUS_TONE[r.status]">{{ tr(`status.${r.status}`) }}</UiBadge>
              <UiBadge v-if="r.openAgainstUser > 1" tone="danger" :icon="Flag">{{ tr('openOnMember', { n: r.openAgainstUser }) }}</UiBadge>
            </div>

            <p class="report__target">
              {{ TARGET[r.targetType].label }}:
              <template v-if="r.targetType === 'listing'">
                <RouterLink v-if="r.listing" :to="`/market/${r.targetId}`">“{{ r.listing.title }}”</RouterLink>
                <span v-else class="subtle">{{ tr('listingDeleted') }}</span>
                <template v-if="r.targetUser"> {{ tr('by') }} </template>
              </template>
              <template v-else-if="r.targetType === 'review'">
                <template v-if="r.review">
                  {{ tr('reviewAbout', { rating: r.review.rating }) }}
                  <RouterLink v-if="r.review.reviewee" :to="{ path: `/u/${r.review.reviewee.id}`, hash: '#reviews' }">{{ r.review.reviewee.name }}</RouterLink>
                  {{ tr('writtenBy') }}
                </template>
                <span v-else class="subtle">{{ tr('reviewGone') }} </span>
              </template>
              <RouterLink v-if="r.targetUser" :to="`/u/${r.targetUser.id}`" class="who">
                <UiAvatar :name="r.targetUser.name" :src="r.targetUser.avatarUrl" :size="20" /> {{ r.targetUser.name }}
              </RouterLink>
              <span v-else-if="r.targetType !== 'listing'" class="subtle">{{ tr('memberDeleted') }}</span>
              <UiBadge v-if="r.targetUser?.suspendedAt" tone="danger">{{ tr('suspended') }}</UiBadge>
            </p>

            <p v-if="r.review?.comment" class="report__details">{{ tr('reviewText', { text: r.review.comment }) }}</p>
            <p v-if="r.details" class="report__details">“{{ r.details }}”</p>
            <p class="subtle report__meta">
              {{ tr('reportedBy', { name: r.reporter?.name ?? tr('deletedMember'), time: timeAgo(r.createdAt) }) }}
              <template v-if="r.reviewer">
                · {{ tr('reviewedBy', { status: tr(`status.${r.status}`), name: r.reviewer.name, time: timeAgo(r.reviewedAt) }) }}
              </template>
            </p>
            <p v-if="r.resolutionNote" class="report__note">{{ tr('note', { note: r.resolutionNote }) }}</p>
          </div>
        </div>
        <div class="report__actions">
          <UiButton
            v-if="r.targetUser && r.targetUser.role !== 'admin'"
            variant="secondary"
            size="sm"
            :icon="Settings2"
            @click="manage(r.targetUser.id)"
          >
            {{ tr('manage') }}
          </UiButton>
          <UiButton v-if="r.targetType === 'review' && r.review" variant="danger" size="sm" :icon="Trash2" @click="removeReview(r)">
            {{ tr('removeReview') }}
          </UiButton>
          <template v-if="r.status === 'open'">
            <UiButton variant="ghost" size="sm" :icon="X" @click="review(r, 'dismissed')">{{ tr('dismiss') }}</UiButton>
            <UiButton size="sm" :icon="Check" @click="review(r, 'resolved')">{{ tr('resolve') }}</UiButton>
          </template>
          <UiButton v-else variant="ghost" size="sm" :icon="RotateCcw" @click="review(r, 'open')">{{ tr('reopen') }}</UiButton>
        </div>
      </UiCard>
    </TransitionGroup>

    <UiSheet
      :open="Boolean(reviewing)"
      :title="tr(decision === 'resolved' ? 'resolveTitle' : decision === 'dismissed' ? 'dismissTitle' : 'reopenTitle')"
      width="440px"
      @update:open="(v) => !v && (reviewing = null)"
    >
      <div class="stack" style="--gap: 12px">
        <p class="muted">
          {{ tr(decision === 'resolved' ? 'resolveText' : decision === 'dismissed' ? 'dismissText' : 'reopenText') }}
        </p>
        <UiTextarea v-model="note" :label="tr('internalNote')" :maxlength="300" :rows="3" />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="reviewing = null">{{ t('common.cancel') }}</UiButton>
        <UiButton :loading="busy" @click="submit">
          {{ tr(decision === 'resolved' ? 'resolve' : decision === 'dismissed' ? 'dismiss' : 'reopen') }}
        </UiButton>
      </template>
    </UiSheet>

    <AdminUserSheet
      v-model:open="sheetOpen"
      :user-id="sheetUserId"
      :plans="props.plans"
      @saved="onUserChanged"
      @deleted="sheetOpen = false; onUserChanged()"
    />
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
.report {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.report__main {
  flex: 1;
  min-width: 280px;
  display: flex;
  gap: 12px;
}
.report__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--danger-soft);
  color: var(--danger);
}
.report__icon svg {
  width: 19px;
  height: 19px;
}
.report__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.report__target {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 0.88rem;
  color: var(--text-2);
}
.report__target a {
  color: var(--primary);
  font-weight: 600;
}
.who {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.report__details {
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--text-2);
}
.report__meta {
  margin-top: 6px;
  font-size: 0.8rem;
}
.report__note {
  margin-top: 4px;
  font-size: 0.84rem;
  color: var(--text-2);
}
.report__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
