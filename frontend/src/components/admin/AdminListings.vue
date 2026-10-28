<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Search, Store, EyeOff, Eye, Trash2, Flag, ChevronLeft, ChevronRight, ExternalLink, Download } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { downloadFromApi } from '@/utils/download';
import { toast } from '@/composables/useToast';
import { formatMoney, timeAgo } from '@/utils/format';
import { getListingCategory } from '@/constants/marketplace';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';

/** Moderate any member's marketplace listing: hide, restore or delete it, telling the seller why. */
const emit = defineEmits(['changed']);

const { t } = useI18n();
const tl = (key, params, n) => (n === undefined ? t(`admin.listings.${key}`, params ?? {}) : t(`admin.listings.${key}`, params ?? {}, n));
const STATUS = computed(() => ['all', 'active', 'archived', 'sold'].map((value) => ({ value, label: tl(`status.${value}`) })));
const filters = ref({ q: '', status: 'all' });
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pages = ref(1);
const loading = ref(true);

let seq = 0;
async function load() {
  const id = ++seq;
  loading.value = true;
  try {
    const { data } = await api.get('/admin/listings', { params: { ...filters.value, page: page.value } });
    if (id !== seq) return;
    items.value = data.items;
    total.value = data.total;
    pages.value = data.pages;
  } catch (err) {
    if (id === seq) toast.error(errorMessage(err));
  } finally {
    if (id === seq) loading.value = false;
  }
}
let timer;
watch(
  filters,
  () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      page.value = 1;
      load();
    }, 250);
  },
  { deep: true },
);
watch(page, load);
onMounted(load);

const acting = ref(null);
const action = ref('hide');
const reason = ref('');
const busy = ref(false);

function ask(listing, kind) {
  acting.value = listing;
  action.value = kind;
  reason.value = '';
}

async function confirm() {
  busy.value = true;
  const l = acting.value;
  try {
    if (action.value === 'delete') {
      await api.delete(`/admin/listings/${l.id}`, { data: { reason: reason.value } });
      toast.success(tl('deleted', { title: l.title }));
    } else {
      await api.patch(`/admin/listings/${l.id}`, { status: 'archived', reason: reason.value });
      toast.success(tl('hidden', { title: l.title }));
    }
    acting.value = null;
    load();
    emit('changed');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = false;
  }
}

async function restore(l) {
  try {
    await api.patch(`/admin/listings/${l.id}`, { status: 'active' });
    toast.success(tl('visible', { title: l.title }));
    load();
    emit('changed');
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

const STATUS_TONE = { active: 'success', archived: 'neutral', sold: 'primary' };

const exporting = ref(false);
async function exportCsv() {
  exporting.value = true;
  try {
    await downloadFromApi('/admin/listings/export.csv', { q: filters.value.q || undefined, status: filters.value.status }, 'profilehub-listings.csv');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="stack" style="--gap: 14px">
    <div class="toolbar">
      <label class="search">
        <Search />
        <input v-model.trim="filters.q" type="search" :placeholder="tl('searchPh')" :aria-label="tl('searchPh')" />
      </label>
      <UiSelect v-model="filters.status" :options="STATUS" :aria-label="tl('status.all')" />
    </div>
    <div class="results">
      <p class="muted"><strong>{{ tl('count', { n: total }, total) }}</strong></p>
      <UiButton size="sm" variant="ghost" :icon="Download" :loading="exporting" :disabled="!total" @click="exportCsv">
        {{ t('admin.exportCsv') }}
      </UiButton>
    </div>

    <div v-if="loading && !items.length" class="stack" style="--gap: 8px">
      <UiSkeleton v-for="i in 5" :key="i" height="72px" />
    </div>
    <UiCard v-else-if="!items.length">
      <UiEmpty :icon="Store" :title="tl('emptyTitle')" :description="tl('emptyText')" />
    </UiCard>

    <div v-else class="list" :class="{ 'is-loading': loading }">
      <UiCard v-for="l in items" :key="l.id" :padded="false" class="row" :style="{ '--hue': getListingCategory(l.category).hue }">
        <div class="thumb">
          <img v-if="l.images?.[0]" :src="l.images[0]" alt="" />
          <component :is="getListingCategory(l.category).icon" v-else />
        </div>
        <div class="grow info">
          <div class="info__top">
            <strong class="truncate">{{ l.title }}</strong>
            <UiBadge :tone="STATUS_TONE[l.status]">{{ tl(`status.${l.status}`) }}</UiBadge>
            <UiBadge v-if="l.openReports" tone="danger" :icon="Flag">{{ tl('openReports', { n: l.openReports }, l.openReports) }}</UiBadge>
          </div>
          <span class="muted">
            {{ l.price ? formatMoney(l.price, l.currency) : t('common.free') }} · {{ l.city || tl('noCity') }} · {{ timeAgo(l.createdAt) }}
          </span>
          <span v-if="l.seller" class="seller">
            <UiAvatar :name="l.seller.name" :src="l.seller.avatarUrl" :size="20" /> {{ l.seller.name }}
            <span class="subtle">{{ l.seller.email }}</span>
          </span>
        </div>
        <div class="actions">
          <UiButton variant="ghost" size="sm" :icon="ExternalLink" icon-only :aria-label="tl('open')" :to="`/market/${l.id}`" />
          <UiButton v-if="l.status === 'archived'" variant="secondary" size="sm" :icon="Eye" @click="restore(l)">{{ tl('restore') }}</UiButton>
          <UiButton v-else-if="l.status === 'active'" variant="secondary" size="sm" :icon="EyeOff" @click="ask(l, 'hide')">{{ tl('hide') }}</UiButton>
          <UiButton variant="ghost" size="sm" :icon="Trash2" icon-only :aria-label="tl('deleteListing')" @click="ask(l, 'delete')" />
        </div>
      </UiCard>
    </div>

    <div v-if="pages > 1" class="pager">
      <UiButton variant="secondary" size="sm" :icon="ChevronLeft" :disabled="page <= 1 || loading" @click="page--">
        {{ t('admin.pager.previous') }}
      </UiButton>
      <span class="muted">{{ t('admin.pager.page', { page, pages }) }}</span>
      <UiButton variant="secondary" size="sm" :icon-right="ChevronRight" :disabled="page >= pages || loading" @click="page++">
        {{ t('admin.pager.next') }}
      </UiButton>
    </div>

    <UiSheet
      :open="Boolean(acting)"
      :title="action === 'delete' ? tl('deleteListing') : tl('hideListing')"
      width="460px"
      @update:open="(v) => !v && (acting = null)"
    >
      <div v-if="acting" class="stack" style="--gap: 12px">
        <p>{{ tl(action === 'delete' ? 'willDelete' : 'willHide', { title: acting.title, seller: acting.seller?.name ?? '' }) }}</p>
        <UiTextarea v-model="reason" :label="tl('reasonLabel')" :maxlength="300" :rows="3" :placeholder="tl('reasonPh')" />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="acting = null">{{ t('common.cancel') }}</UiButton>
        <UiButton variant="danger" :loading="busy" :disabled="reason.trim().length < 3" @click="confirm">
          {{ action === 'delete' ? tl('deleteListing') : tl('hideListing') }}
        </UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}
.search {
  position: relative;
  display: flex;
  align-items: center;
}
.search svg {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: var(--text-3);
  pointer-events: none;
}
.search input {
  width: 100%;
  height: 44px;
  padding: 0 14px 0 42px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.92rem;
}
.search input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 0.2s;
}
.list.is-loading {
  opacity: 0.6;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
}
.thumb {
  display: grid;
  place-items: center;
  width: 64px;
  height: 52px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: hsl(var(--hue) 70% 94%);
  color: hsl(var(--hue) 55% 45%);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb svg {
  width: 22px;
  height: 22px;
}
.info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.86rem;
}
.info__top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.seller {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
}
.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
@media (min-width: 760px) {
  .toolbar {
    grid-template-columns: minmax(0, 1fr) 180px;
  }
}
</style>
