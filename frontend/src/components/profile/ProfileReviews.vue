<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Star, Flag, Trash2, Pencil, MessageSquareQuote, Info } from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import ReportDialog from '@/components/ReportDialog.vue';

const props = defineProps({
  /** The profile being viewed: needs id, name and isMe. */
  member: { type: Object, required: true },
});
const emit = defineEmits(['summary']);

const { t } = useI18n();
const auth = useAuthStore();
const isAdmin = computed(() => auth.user?.role === 'admin');

const items = ref([]);
const summary = ref({ average: null, count: 0 });
const mine = ref(null);
const canReview = ref(false);
const hint = ref('');
const page = ref(1);
const pages = ref(1);
const loading = ref(true);
const loadingMore = ref(false);

const formOpen = ref(false);
const rating = ref(0);
const hover = ref(0);
const comment = ref('');
const errors = ref({});
const saving = ref(false);

const reportTarget = ref(null);
const reportOpen = ref(false);

async function load({ append = false } = {}) {
  if (append) loadingMore.value = true;
  else loading.value = true;
  try {
    const { data } = await api.get(`/reviews/user/${props.member.id}`, { params: { page: append ? page.value + 1 : 1, limit: 10 } });
    items.value = append ? [...items.value, ...data.items] : data.items;
    Object.assign(summary.value, data.summary);
    mine.value = data.mine;
    canReview.value = data.canReview;
    hint.value = data.reviewHint || '';
    page.value = data.page;
    pages.value = data.pages;
    emit('summary', data.summary);
  } catch {
    /* the section simply stays empty */
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

watch(() => props.member.id, () => load(), { immediate: true });

function openForm() {
  rating.value = mine.value?.rating || 0;
  comment.value = mine.value?.comment || '';
  errors.value = {};
  formOpen.value = true;
}

async function save() {
  if (!rating.value) {
    errors.value = { rating: t('reviews.pickRating') };
    return;
  }
  saving.value = true;
  errors.value = {};
  try {
    const existed = Boolean(mine.value);
    await api.put(`/reviews/user/${props.member.id}`, { rating: rating.value, comment: comment.value });
    formOpen.value = false;
    toast.success(existed ? t('reviews.updated') : t('reviews.posted'));
    await load();
  } catch (err) {
    errors.value = fieldErrors(err);
    if (!Object.keys(errors.value).length) toast.error(errorMessage(err));
  } finally {
    saving.value = false;
  }
}

async function removeMine() {
  if (!window.confirm(t('reviews.removeConfirm'))) return;
  try {
    await api.delete(`/reviews/user/${props.member.id}`);
    formOpen.value = false;
    toast.success(t('reviews.removed'));
    await load();
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

async function adminRemove(review) {
  const reason = window.prompt(t('reviews.adminRemoveReason'), '');
  if (reason === null) return;
  try {
    await api.delete(`/admin/reviews/${review.id}`, { data: { reason } });
    toast.success(t('reviews.adminRemoved'));
    await load();
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

function report(review) {
  reportTarget.value = review;
  reportOpen.value = true;
}

const stars = (n) => Array.from({ length: 5 }, (_, i) => i < Math.round(n || 0));
</script>

<template>
  <UiCard id="reviews" class="reviews">
    <div class="row-between reviews__head">
      <h2 class="section-title">
        {{ t('reviews.title') }}
        <span v-if="summary.count" class="subtle">· {{ summary.count }}</span>
      </h2>
      <UiButton v-if="canReview" size="sm" :variant="mine ? 'ghost' : 'soft'" :icon="mine ? Pencil : Star" @click="openForm">
        {{ mine ? t('reviews.editMine') : t('reviews.write') }}
      </UiButton>
    </div>

    <div v-if="loading" class="stack" style="--gap: 10px">
      <UiSkeleton width="40%" height="22px" />
      <UiSkeleton height="54px" />
    </div>

    <template v-else>
      <div v-if="summary.count" class="reviews__summary">
        <strong class="reviews__avg">{{ summary.average.toFixed(1) }}</strong>
        <div>
          <span class="stars" aria-hidden="true">
            <Star v-for="(on, i) in stars(summary.average)" :key="i" :class="{ on }" />
          </span>
          <p class="muted">{{ t('reviews.summary', { avg: summary.average, n: summary.count }, summary.count) }}</p>
        </div>
      </div>
      <p v-else class="subtle reviews__empty">
        <MessageSquareQuote /> {{ member.isMe ? t('reviews.noneMine') : t('reviews.none') }}
      </p>

      <p v-if="!member.isMe && !canReview && hint && !mine" class="reviews__hint"><Info /> {{ hint }}</p>

      <form v-if="formOpen" class="reviews__form" novalidate @submit.prevent="save">
        <div class="stack" style="--gap: 6px">
          <span class="field-label">{{ t('reviews.rating') }}</span>
          <div class="star-picker" role="radiogroup" :aria-label="t('reviews.rating')" @mouseleave="hover = 0">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              role="radio"
              :aria-checked="rating === n"
              :aria-label="t('reviews.stars', { n }, n)"
              :class="{ on: n <= (hover || rating) }"
              @mouseenter="hover = n"
              @click="rating = n"
            >
              <Star />
            </button>
          </div>
          <p v-if="errors.rating" class="error-text">{{ errors.rating }}</p>
        </div>
        <UiTextarea
          v-model="comment"
          :label="t('reviews.comment')"
          :maxlength="1000"
          :rows="3"
          :placeholder="t('reviews.commentPlaceholder')"
          :error="errors.comment"
        />
        <p class="subtle reviews__guidance">{{ t('reviews.guidance') }}</p>
        <div class="row reviews__actions">
          <UiButton v-if="mine" variant="ghost" :icon="Trash2" class="danger-text" @click="removeMine">{{ t('reviews.remove') }}</UiButton>
          <span class="grow" />
          <UiButton variant="secondary" @click="formOpen = false">{{ t('common.cancel') }}</UiButton>
          <UiButton type="submit" :loading="saving">{{ mine ? t('reviews.update') : t('reviews.submit') }}</UiButton>
        </div>
      </form>

      <ul v-if="items.length" class="reviews__list">
        <li v-for="r in items" :key="r.id" class="review">
          <RouterLink v-if="r.reviewer" :to="`/u/${r.reviewer.id}`">
            <UiAvatar :name="r.reviewer.name" :src="r.reviewer.avatarUrl" :size="40" />
          </RouterLink>
          <div class="review__body">
            <div class="review__top">
              <RouterLink v-if="r.reviewer" :to="`/u/${r.reviewer.id}`" class="review__name">{{ r.reviewer.name }}</RouterLink>
              <span class="stars stars--sm" :aria-label="t('reviews.stars', { n: r.rating }, r.rating)">
                <Star v-for="(on, i) in stars(r.rating)" :key="i" :class="{ on }" />
              </span>
              <span class="subtle review__time">{{ timeAgo(r.updatedAt || r.createdAt) }}</span>
            </div>
            <p v-if="r.comment" class="review__comment">{{ r.comment }}</p>
          </div>
          <div class="review__actions">
            <button
              v-if="r.reviewer && r.reviewer.id !== auth.user?.id"
              type="button"
              class="icon-action"
              :aria-label="t('reviews.report')"
              :title="t('reviews.report')"
              @click="report(r)"
            >
              <Flag />
            </button>
            <button
              v-if="isAdmin"
              type="button"
              class="icon-action icon-action--danger"
              :aria-label="t('reviews.adminRemove')"
              :title="t('reviews.adminRemove')"
              @click="adminRemove(r)"
            >
              <Trash2 />
            </button>
          </div>
        </li>
      </ul>

      <div v-if="page < pages" class="reviews__more">
        <UiButton variant="ghost" size="sm" :loading="loadingMore" @click="load({ append: true })">{{ t('reviews.showMore') }}</UiButton>
      </div>
    </template>

    <ReportDialog
      v-if="reportTarget"
      v-model:open="reportOpen"
      target-type="review"
      :target-id="reportTarget.id"
      :target-label="`${t('reviews.title')} · ${reportTarget.reviewer?.name ?? ''}`"
    />
  </UiCard>
</template>

<style scoped>
.reviews {
  scroll-margin-top: calc(var(--nav-h) + 16px);
}
.reviews__head {
  margin-bottom: 12px;
}
.reviews__summary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--surface-2);
}
.reviews__avg {
  font-size: 2rem;
  line-height: 1;
}
.reviews__summary p {
  font-size: 0.84rem;
}
.reviews__empty,
.reviews__hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
}
.reviews__hint {
  margin-top: 10px;
  color: var(--text-2);
}
.reviews__empty svg,
.reviews__hint svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.stars {
  display: inline-flex;
  gap: 2px;
  color: var(--border-strong);
}
.stars svg {
  width: 18px;
  height: 18px;
}
.stars--sm svg {
  width: 14px;
  height: 14px;
}
.stars .on {
  color: #f59e0b;
  fill: #f59e0b;
}
.reviews__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 14px;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.field-label {
  font-size: 0.86rem;
  font-weight: 600;
}
.star-picker {
  display: flex;
  gap: 4px;
}
.star-picker button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--border-strong);
  transition: transform 0.12s var(--ease), color 0.12s var(--ease);
}
.star-picker button:hover {
  transform: scale(1.1);
}
.star-picker button svg {
  width: 28px;
  height: 28px;
}
.star-picker button.on {
  color: #f59e0b;
}
.star-picker button.on svg {
  fill: #f59e0b;
}
.error-text {
  color: var(--danger);
  font-size: 0.82rem;
}
.reviews__guidance {
  font-size: 0.78rem;
  margin-top: -6px;
}
.reviews__actions {
  flex-wrap: wrap;
  gap: 8px;
}
.danger-text {
  color: var(--danger) !important;
}
.reviews__list {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.review {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
}
.review__body {
  flex: 1;
  min-width: 0;
}
.review__top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.review__name {
  font-weight: 700;
}
.review__name:hover {
  color: var(--primary);
}
.review__time {
  font-size: 0.78rem;
}
.review__comment {
  margin-top: 4px;
  font-size: 0.92rem;
  color: var(--text-2);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.review__actions {
  display: flex;
  gap: 4px;
}
.icon-action {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
}
.icon-action:hover {
  background: var(--surface-3);
  color: var(--text);
}
.icon-action--danger:hover {
  color: var(--danger);
}
.icon-action svg {
  width: 15px;
  height: 15px;
}
.reviews__more {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}
</style>
