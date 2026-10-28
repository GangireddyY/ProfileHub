<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import {
  Bell,
  BellRing,
  UserPlus,
  UserCheck,
  CheckCheck,
  BriefcaseBusiness,
  CircleCheck,
  CircleX,
  Crown,
  Flag,
  TriangleAlert,
  Hourglass,
  Star,
} from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { formatDate } from '@/constants/plans';
import { api, errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useRealtimeStore } from '@/stores/realtime';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import UiTabs from '@/components/ui/UiTabs.vue';
import ConnectButton from '@/components/ConnectButton.vue';
import ProfessionBadge from '@/components/ProfessionBadge.vue';
import BackButton from '@/components/BackButton.vue';

const auth = useAuthStore();
const realtime = useRealtimeStore();

const items = ref([]);
const hasMore = ref(false);
const loading = ref(true);
const loadingMore = ref(false);
const filter = ref('all');

const { t } = useI18n();
const T = (key, params) => t(`notifications.text.${key}`, params);
const TEXT = {
  connection_request: () => T('connection_request'),
  connection_accepted: () => T('connection_accepted'),
  profession_request: (m) => T('profession_request', { label: m?.label ?? '' }),
  profession_approved: (m) => T('profession_approved', { label: m?.professionLabel ?? m?.label ?? '' }),
  profession_rejected: (m) => T('profession_rejected', { label: m?.label ?? '' }),
  plan_request: (m) => T('plan_request', { plan: m?.planName ?? '' }),
  plan_approved: (m) => T('plan_approved', { plan: m?.planName ?? '' }),
  plan_rejected: (m) => T('plan_rejected', { plan: m?.planName ?? '' }),
  signup_request: () => T('signup_request'),
  account_approved: () => T('account_approved'),
  report_new: (m) => T('report_new', { target: t(`notifications.target.${m?.targetType || 'user'}`) }),
  listing_removed: (m) => T(m?.action === 'deleted' ? 'listing_removed_deleted' : 'listing_removed_hidden', { title: m?.title ?? '' }),
  plan_expiring: (m) => T('plan_expiring', { plan: m?.planName ?? '', date: m?.endsAt ? formatDate(m.endsAt) : '' }),
  plan_expired: (m) => T('plan_expired', { plan: m?.planName ?? '', fallback: m?.fallbackName ?? '' }),
  review_new: (m) => T('review_new', { rating: m?.rating ?? '' }),
};
const ICON = {
  connection_request: UserPlus,
  connection_accepted: UserCheck,
  profession_request: BriefcaseBusiness,
  profession_approved: CircleCheck,
  profession_rejected: CircleX,
  plan_request: Crown,
  plan_approved: CircleCheck,
  plan_rejected: CircleX,
  signup_request: UserPlus,
  account_approved: CircleCheck,
  report_new: Flag,
  listing_removed: TriangleAlert,
  plan_expiring: Hourglass,
  plan_expired: Crown,
  review_new: Star,
};
const isProfession = (n) => n.type.startsWith('profession_');
const isPlan = (n) => n.type.startsWith('plan_');

const filters = computed(() => [
  { key: 'all', label: t('notifications.all'), icon: BellRing, count: items.value.length },
  {
    key: 'connection_request',
    label: t('notifications.invitations'),
    icon: UserPlus,
    count: items.value.filter((n) => n.type === 'connection_request').length,
  },
  {
    key: 'connection_accepted',
    label: t('notifications.accepted'),
    icon: UserCheck,
    count: items.value.filter((n) => n.type === 'connection_accepted').length,
  },
  {
    key: 'review_new',
    label: t('notifications.reviews'),
    icon: Star,
    count: items.value.filter((n) => n.type === 'review_new').length,
  },
  {
    key: 'profession',
    label: t('notifications.professions'),
    icon: BriefcaseBusiness,
    count: items.value.filter(isProfession).length,
  },
]);
const mobileTabs = computed(() => filters.value.map(({ key, label }) => ({ key, label })));
const visible = computed(() => {
  if (filter.value === 'all') return items.value;
  if (filter.value === 'profession') return items.value.filter(isProfession);
  return items.value.filter((n) => n.type === filter.value);
});

async function markAllRead() {
  if (!auth.user?.unreadNotifications) return;
  auth.user.unreadNotifications = 0;
  await api.post('/notifications/read-all').catch(() => {});
}

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true;
  try {
    const { data } = await api.get('/notifications');
    items.value = data.items;
    hasMore.value = data.hasMore;
    markAllRead();
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  const last = items.value[items.value.length - 1];
  if (!last) return;
  loadingMore.value = true;
  try {
    const { data } = await api.get('/notifications', { params: { before: last.createdAt } });
    items.value.push(...data.items);
    hasMore.value = data.hasMore;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loadingMore.value = false;
  }
}

function onStatusChange(item, { status }) {
  item.actor.connectionStatus = status;
  auth.fetchMe().catch(() => {});
}

onMounted(load);
watch(() => realtime.networkVersion, () => load({ silent: true }));
watch(
  () => auth.user?.unreadNotifications,
  (n) => n && load({ silent: true }),
);
</script>

<template>
  <div class="container page-layout">
    <aside class="page-aside page-aside--sticky desktop-aside">
      <UiCard :padded="false">
        <header class="filters__head">
          <span class="filters__icon"><Bell /></span>
          <div>
            <strong>{{ t('notifications.title') }}</strong>
            <p class="muted">{{ t('notifications.recent', { n: items.length }) }}</p>
          </div>
        </header>
        <nav class="filters__nav" :aria-label="t('notifications.filterLabel')">
          <button
            v-for="f in filters"
            :key="f.key"
            type="button"
            class="filters__item"
            :class="{ 'is-active': filter === f.key }"
            @click="filter = f.key"
          >
            <span><component :is="f.icon" /> {{ f.label }}</span>
            <strong>{{ f.count }}</strong>
          </button>
        </nav>
      </UiCard>
    </aside>

    <section class="page-main">
      <BackButton />
      <header class="page-head">
        <div>
          <h1 class="page-title">{{ t('notifications.title') }}</h1>
          <p class="muted">{{ t('notifications.lead') }}</p>
        </div>
      </header>

      <UiTabs v-model="filter" :tabs="mobileTabs" class="mobile-tabs" />

      <UiCard :padded="false">
        <div v-if="loading" class="list">
          <div v-for="i in 5" :key="i" class="item">
            <UiSkeleton width="52px" height="52px" radius="50%" />
            <div class="stack grow" style="--gap: 8px">
              <UiSkeleton width="70%" height="14px" />
              <UiSkeleton width="30%" height="12px" />
            </div>
          </div>
        </div>

        <UiEmpty
          v-else-if="!visible.length"
          :icon="Bell"
          :title="items.length ? t('notifications.emptyFilter') : t('notifications.caughtUp')"
          :description="t('notifications.emptyText')"
        >
          <UiButton to="/" variant="soft">{{ t('common.discoverPeople') }}</UiButton>
        </UiEmpty>

        <TransitionGroup v-else name="list" tag="ul" class="list">
          <li v-for="n in visible" :key="n.id" class="item" :class="{ 'is-unread': !n.readAt }">
            <component :is="n.actor ? 'RouterLink' : 'span'" :to="n.actor ? `/u/${n.actor.id}` : undefined" class="item__avatar">
              <UiAvatar :name="n.actor?.name || 'ProfileHUB'" :src="n.actor?.avatarUrl || '/favicon.svg'" :size="52" />
              <span class="item__type" :class="`item__type--${n.type}`"><component :is="ICON[n.type] || Bell" /></span>
            </component>

            <div class="item__body">
              <p class="item__text">
                <RouterLink v-if="n.actor" :to="`/u/${n.actor.id}`" class="item__name">{{ n.actor.name }}</RouterLink>
                <strong v-else class="item__name">ProfileHUB</strong>
                {{ TEXT[n.type]?.(n.meta) }}
              </p>
              <p v-if="n.type === 'profession_rejected' && n.meta?.reviewNote" class="item__note">“{{ n.meta.reviewNote }}”</p>
              <p v-else-if="isPlan(n) && n.type !== 'plan_request' && n.meta?.reviewNote" class="item__note">“{{ n.meta.reviewNote }}”</p>
              <p v-else-if="n.type === 'plan_request' && n.meta?.message" class="item__note">“{{ n.meta.message }}”</p>
              <p v-else-if="n.type === 'listing_removed' && n.meta?.reason" class="item__note">{{ t('notifications.reason', { reason: n.meta.reason }) }}</p>
              <p v-else-if="n.type === 'review_new' && n.meta?.comment" class="item__note">“{{ n.meta.comment }}”</p>
              <div class="row wrap item__meta" style="--gap: 8px">
                <ProfessionBadge v-if="n.actor" :profession="n.actor.profession" size="sm" />
                <span class="subtle">{{ timeAgo(n.createdAt) }}</span>
              </div>
            </div>

            <div class="item__actions">
              <UiButton v-if="n.type === 'signup_request'" size="sm" :to="{ path: '/admin', query: { tab: 'approvals' } }">{{ t('common.review') }}</UiButton>
              <UiButton v-else-if="n.type === 'report_new'" size="sm" :to="{ path: '/admin', query: { tab: 'reports' } }">{{ t('common.review') }}</UiButton>
              <UiButton v-else-if="n.type === 'account_approved'" size="sm" variant="soft" to="/welcome">{{ t('notifications.setupProfile') }}</UiButton>
              <UiButton v-else-if="n.type === 'review_new'" size="sm" variant="soft" :to="{ path: `/u/${auth.user.id}`, hash: '#reviews' }">
                {{ t('notifications.seeReviews') }}
              </UiButton>
              <UiButton v-else-if="n.type === 'listing_removed'" size="sm" variant="ghost" :to="{ path: '/market', query: { tab: 'mine' } }">
                {{ t('nav.myListings') }}
              </UiButton>
              <UiButton v-else-if="n.type === 'plan_expiring' || n.type === 'plan_expired'" size="sm" variant="soft" to="/plans">
                {{ t('common.viewPlans') }}
              </UiButton>
              <template v-else-if="!n.actor" />
              <template v-else-if="isProfession(n)">
                <UiButton
                  v-if="n.type === 'profession_request'"
                  size="sm"
                  :variant="n.meta?.status === 'pending' ? 'primary' : 'ghost'"
                  to="/admin"
                >
                  {{ n.meta?.status === 'pending' ? t('common.review') : t('common.reviewed') }}
                </UiButton>
                <UiButton v-else-if="n.type === 'profession_approved'" size="sm" variant="soft" to="/settings#profile">
                  {{ t('common.viewProfile') }}
                </UiButton>
                <UiButton v-else size="sm" variant="ghost" to="/settings#profile">{{ t('notifications.pickAnother') }}</UiButton>
              </template>
              <template v-else-if="isPlan(n)">
                <UiButton
                  v-if="n.type === 'plan_request'"
                  size="sm"
                  :variant="n.meta?.status === 'pending' ? 'primary' : 'ghost'"
                  :to="{ path: '/admin', query: { tab: 'plan-requests' } }"
                >
                  {{ n.meta?.status === 'pending' ? t('common.review') : t('common.reviewed') }}
                </UiButton>
                <UiButton v-else size="sm" :variant="n.type === 'plan_approved' ? 'soft' : 'ghost'" to="/plans">{{ t('common.viewPlans') }}</UiButton>
              </template>
              <ConnectButton
                v-else-if="n.type === 'connection_request' && n.actor.connectionStatus !== 'none'"
                :user="n.actor"
                size="sm"
                @change="onStatusChange(n, $event)"
              />
              <span v-else-if="n.type === 'connection_request'" class="subtle handled"><CheckCheck /> {{ t('notifications.handled') }}</span>
              <UiButton
                v-else-if="n.actor.connectionStatus === 'connected'"
                size="sm"
                variant="soft"
                :to="`/messages/${n.actor.id}`"
              >
                {{ t('common.message') }}
              </UiButton>
            </div>
          </li>
        </TransitionGroup>

        <div v-if="hasMore" class="more">
          <UiButton variant="ghost" :loading="loadingMore" @click="loadMore">{{ t('notifications.loadOlder') }}</UiButton>
        </div>
      </UiCard>
    </section>
  </div>
</template>

<style scoped>
.filters__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.filters__head p {
  font-size: 0.84rem;
}
.filters__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--primary-soft);
  color: var(--primary);
}
.filters__icon svg {
  width: 20px;
  height: 20px;
}
.filters__nav {
  display: flex;
  flex-direction: column;
  padding: 6px;
}
.filters__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.9rem;
  transition: background-color 0.15s var(--ease), color 0.15s var(--ease);
}
.filters__item:hover {
  background: var(--surface-2);
  color: var(--text);
}
.filters__item.is-active {
  background: var(--primary-soft);
  color: var(--primary);
}
.filters__item span {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.filters__item svg {
  width: 18px;
  height: 18px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 6px;
}
.item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: var(--radius);
  transition: background-color 0.2s var(--ease);
}
.item + .item {
  margin-top: 2px;
}
.item.is-unread {
  background: var(--primary-soft);
}
.item__avatar {
  position: relative;
  flex-shrink: 0;
}
.item__type {
  position: absolute;
  right: -4px;
  bottom: -4px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--surface);
  color: #fff;
}
.item__type svg {
  width: 13px;
  height: 13px;
}
.item__type--connection_request {
  background: var(--primary);
}
.item__type--review_new {
  background: #f59e0b;
}
.item__type--connection_accepted,
.item__type--profession_approved,
.item__type--plan_approved,
.item__type--account_approved {
  background: var(--success);
}
.item__type--profession_request,
.item__type--plan_request,
.item__type--signup_request,
.item__type--plan_expiring {
  background: var(--warning);
}
.item__type--profession_rejected,
.item__type--plan_rejected,
.item__type--report_new,
.item__type--listing_removed,
.item__type--plan_expired {
  background: var(--danger);
}
.item__note {
  margin-top: 4px;
  font-size: 0.86rem;
  color: var(--text-2);
  font-style: italic;
}
.item__body {
  flex: 1;
  min-width: 0;
}
.item__text {
  font-size: 0.94rem;
  color: var(--text-2);
}
.item__name {
  font-weight: 700;
  color: var(--text);
}
.item__name:hover {
  color: var(--primary);
}
.item__meta {
  margin-top: 6px;
  font-size: 0.8rem;
}
.item__actions {
  flex-shrink: 0;
}
.handled {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
}
.handled svg {
  width: 15px;
  height: 15px;
}
.more {
  display: flex;
  justify-content: center;
  padding: 8px 0 14px;
}

.desktop-aside {
  display: none;
}
@media (min-width: 1024px) {
  .desktop-aside {
    display: flex;
  }
  .mobile-tabs {
    display: none;
  }
}
@media (max-width: 559px) {
  .item {
    flex-wrap: wrap;
  }
  .item__actions {
    width: 100%;
    padding-left: 66px;
  }
  .item__actions :deep(.connect) {
    width: 100%;
  }
  .item__actions :deep(.connect > *) {
    flex: 1;
  }
}
</style>
