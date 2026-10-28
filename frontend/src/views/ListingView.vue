<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Navigation,
  Clock3,
  Eye,
  MessageCircle,
  Pencil,
  CircleCheck,
  RotateCcw,
  EyeOff,
  Trash2,
  Share2,
  PackageX,
  ShieldCheck,
} from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { toast } from '@/composables/useToast';
import { getListingCategory, conditionLabel } from '@/constants/marketplace';
import { formatMoney, formatDistance, timeAgo, formatRate } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import ProfessionBadge from '@/components/ProfessionBadge.vue';
import ConnectButton from '@/components/ConnectButton.vue';
import ListingCard from '@/components/market/ListingCard.vue';
import BackButton from '@/components/BackButton.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();

const listing = ref(null);
const more = ref([]);
const loading = ref(true);
const error = ref('');
const active = ref(0);
const busy = ref('');
const confirmDelete = ref(false);

const category = computed(() => getListingCategory(listing.value?.category));
const images = computed(() => listing.value?.images || []);
const seller = computed(() => listing.value?.seller);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/listings/${props.id}`);
    listing.value = data.listing;
    more.value = data.moreFromSeller;
    active.value = 0;
    document.title = `${data.listing.title} · Marketplace · ProfileHUB`;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}
watch(() => props.id, load, { immediate: true });

function step(delta) {
  const n = images.value.length;
  if (n) active.value = (active.value + delta + n) % n;
}

function messageSeller() {
  router.push({
    path: `/messages/${seller.value.id}`,
    query: { text: `Hi ${seller.value.name.split(' ')[0]}! Is “${listing.value.title}” still available?` },
  });
}

async function setStatus(status, message) {
  busy.value = status;
  try {
    const { data } = await api.patch(`/listings/${listing.value.id}/status`, { status });
    Object.assign(listing.value, data.listing);
    toast.success(message);
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = '';
  }
}

async function remove() {
  busy.value = 'delete';
  try {
    await api.delete(`/listings/${listing.value.id}`);
    toast.success('Listing deleted');
    router.replace('/market');
  } catch (err) {
    toast.error(errorMessage(err));
    busy.value = '';
  }
}

async function share() {
  const url = `${location.origin}/market/${listing.value.id}`;
  try {
    if (navigator.share) await navigator.share({ title: listing.value.title, url });
    else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  } catch {
    /* dismissed */
  }
}

function onKey(e) {
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
}
</script>

<template>
  <div class="container listing-page">
    <BackButton fallback="/market" />

    <div v-if="loading" class="layout">
      <UiSkeleton height="auto" radius="20px" style="aspect-ratio: 4 / 3" />
      <UiCard class="stack" style="--gap: 12px">
        <UiSkeleton width="40%" height="28px" />
        <UiSkeleton width="80%" height="18px" />
        <UiSkeleton width="60%" height="14px" />
        <UiSkeleton height="46px" radius="12px" />
      </UiCard>
    </div>

    <UiCard v-else-if="error">
      <UiEmpty :icon="PackageX" title="Listing unavailable" :description="error">
        <UiButton to="/market" variant="secondary">Back to Marketplace</UiButton>
      </UiEmpty>
    </UiCard>

    <template v-else-if="listing">
      <div class="layout">
        <div class="stack" style="--gap: 16px; min-width: 0">
          <div class="gallery" :style="{ '--hue': category.hue }" tabindex="0" aria-label="Photos" @keydown="onKey">
            <div class="gallery__main">
              <Transition name="fade" mode="out-in">
                <img v-if="images.length" :key="images[active]" :src="images[active]" :alt="listing.title" />
                <div v-else class="gallery__placeholder"><component :is="category.icon" /></div>
              </Transition>
              <span v-if="listing.status !== 'active'" class="gallery__status">
                {{ listing.status === 'sold' ? 'Sold' : 'Hidden from Marketplace' }}
              </span>
              <template v-if="images.length > 1">
                <button type="button" class="gallery__nav gallery__nav--prev" aria-label="Previous photo" @click="step(-1)">
                  <ChevronLeft />
                </button>
                <button type="button" class="gallery__nav gallery__nav--next" aria-label="Next photo" @click="step(1)">
                  <ChevronRight />
                </button>
                <span class="gallery__counter">{{ active + 1 }} / {{ images.length }}</span>
              </template>
            </div>
            <div v-if="images.length > 1" class="gallery__thumbs scroll-x">
              <button
                v-for="(src, i) in images"
                :key="src"
                type="button"
                class="thumb"
                :class="{ 'is-active': i === active }"
                :aria-label="`Photo ${i + 1}`"
                @click="active = i"
              >
                <img :src="src" alt="" loading="lazy" />
              </button>
            </div>
          </div>

          <UiCard>
            <h2 class="section-title">Description</h2>
            <p class="description">{{ listing.description || 'The seller has not added a description.' }}</p>
            <dl class="facts">
              <div><dt>Category</dt><dd><component :is="category.icon" /> {{ category.label }}</dd></div>
              <div><dt>Condition</dt><dd>{{ conditionLabel(listing.condition) }}</dd></div>
              <div v-if="listing.city"><dt>Location</dt><dd>{{ listing.city }}</dd></div>
              <div><dt>Posted</dt><dd>{{ timeAgo(listing.createdAt) }}</dd></div>
            </dl>
          </UiCard>
        </div>

        <div class="side">
          <UiCard class="summary">
            <div class="row-between">
              <UiBadge :tone="listing.status === 'active' ? 'success' : 'neutral'" dot>
                {{ listing.status === 'active' ? 'Available' : listing.status === 'sold' ? 'Sold' : 'Hidden' }}
              </UiBadge>
              <UiButton variant="ghost" size="sm" :icon="Share2" icon-only aria-label="Share listing" @click="share" />
            </div>
            <p class="price">{{ listing.price ? formatMoney(listing.price, listing.currency) : 'Free' }}</p>
            <p v-if="listing.negotiable" class="nego">Price negotiable</p>
            <h1 class="title">{{ listing.title }}</h1>
            <div class="meta">
              <span v-if="listing.distanceKm != null" class="meta__near"><Navigation /> {{ formatDistance(listing.distanceKm) }}</span>
              <span v-else-if="listing.city"><MapPin /> {{ listing.city }}</span>
              <span><Clock3 /> {{ timeAgo(listing.createdAt) }}</span>
              <span><Eye /> {{ listing.viewCount }} views</span>
            </div>

            <div v-if="listing.isMine" class="owner-actions">
              <UiButton :to="`/market/${listing.id}/edit`" :icon="Pencil" block>Edit listing</UiButton>
              <UiButton
                v-if="listing.status !== 'sold'"
                variant="secondary"
                :icon="CircleCheck"
                block
                :loading="busy === 'sold'"
                @click="setStatus('sold', 'Marked as sold. Congrats!')"
              >
                Mark as sold
              </UiButton>
              <UiButton
                v-if="listing.status !== 'active'"
                variant="secondary"
                :icon="RotateCcw"
                block
                :loading="busy === 'active'"
                @click="setStatus('active', 'Your listing is live again')"
              >
                Make available again
              </UiButton>
              <div class="row">
                <UiButton
                  v-if="listing.status === 'active'"
                  variant="ghost"
                  :icon="EyeOff"
                  class="grow"
                  :loading="busy === 'archived'"
                  @click="setStatus('archived', 'Hidden from the Marketplace')"
                >
                  Hide
                </UiButton>
                <UiButton variant="danger" :icon="Trash2" class="grow" @click="confirmDelete = true">Delete</UiButton>
              </div>
            </div>
            <template v-else-if="seller">
              <UiButton size="lg" block :icon="MessageCircle" :disabled="listing.status !== 'active'" @click="messageSeller">
                Message seller
              </UiButton>
              <p class="safety"><ShieldCheck /> Meet in a public place and check the item before you pay.</p>
            </template>
          </UiCard>

          <UiCard v-if="seller && !listing.isMine" class="seller">
            <h2 class="seller__heading">Seller</h2>
            <RouterLink :to="`/u/${seller.id}`" class="seller__who">
              <UiAvatar :name="seller.name" :src="seller.avatarUrl" :size="52" :online="seller.online" />
              <div class="grow" style="min-width: 0">
                <strong class="truncate" style="display: block">{{ seller.name }}</strong>
                <span class="muted truncate" style="display: block; font-size: 0.84rem">
                  {{ seller.roleTitle || seller.city || 'Member' }}
                </span>
              </div>
            </RouterLink>
            <div class="row wrap" style="--gap: 6px">
              <ProfessionBadge :profession="seller.profession" size="sm" />
              <UiBadge v-if="formatRate(seller)" tone="success">{{ formatRate(seller) }}</UiBadge>
            </div>
            <div class="row" style="--gap: 8px">
              <UiButton :to="`/u/${seller.id}`" variant="secondary" size="sm" class="grow">View profile</UiButton>
              <ConnectButton :user="seller" size="sm" @change="seller.connectionStatus = $event.status" />
            </div>
          </UiCard>
        </div>
      </div>

      <section v-if="more.length" class="more">
        <div class="row-between">
          <h2 class="section-title">More from {{ seller?.name?.split(' ')[0] || 'this seller' }}</h2>
          <UiButton :to="{ path: '/market', query: { seller: listing.sellerId } }" variant="ghost" size="sm">See all</UiButton>
        </div>
        <div class="more__grid">
          <ListingCard v-for="l in more" :key="l.id" :listing="l" compact />
        </div>
      </section>
    </template>

    <UiSheet v-model:open="confirmDelete" title="Delete this listing?" width="420px">
      <p class="muted">“{{ listing?.title }}” and its photos will be removed permanently.</p>
      <template #footer>
        <UiButton variant="secondary" class="grow" @click="confirmDelete = false">Cancel</UiButton>
        <UiButton variant="danger" class="grow" :icon="Trash2" :loading="busy === 'delete'" @click="remove">Delete</UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.listing-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.gallery {
  display: flex;
  flex-direction: column;
  gap: 10px;
  outline: none;
}
.gallery__main {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: #0b1020;
  border: 1px solid var(--border);
}
.gallery__main img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.gallery__placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: radial-gradient(120% 120% at 0% 0%, hsl(var(--hue) 85% 85%), transparent 60%),
    linear-gradient(135deg, hsl(var(--hue) 70% 92%), hsl(calc(var(--hue) + 30) 70% 84%));
  color: hsl(var(--hue) 55% 42%);
}
[data-theme='dark'] .gallery__placeholder {
  background: radial-gradient(120% 120% at 0% 0%, hsl(var(--hue) 60% 30% / 0.6), transparent 60%),
    linear-gradient(135deg, hsl(var(--hue) 40% 18%), hsl(calc(var(--hue) + 30) 40% 14%));
  color: hsl(var(--hue) 80% 72%);
}
.gallery__placeholder svg {
  width: 26%;
  height: 26%;
  stroke-width: 1.3;
}
.gallery__status {
  position: absolute;
  top: 14px;
  left: 14px;
  padding: 6px 12px;
  border-radius: 99px;
  background: rgba(15, 23, 42, 0.8);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 800;
}
.gallery__nav {
  position: absolute;
  top: 50%;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  margin-top: -21px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  box-shadow: var(--shadow);
  transition: transform 0.15s var(--ease);
}
.gallery__nav:hover {
  transform: scale(1.06);
}
.gallery__nav svg {
  width: 22px;
  height: 22px;
}
.gallery__nav--prev {
  left: 12px;
}
.gallery__nav--next {
  right: 12px;
}
.gallery__counter {
  position: absolute;
  right: 14px;
  bottom: 14px;
  padding: 4px 10px;
  border-radius: 99px;
  background: rgba(15, 23, 42, 0.7);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}
.thumb {
  flex-shrink: 0;
  width: 76px;
  height: 58px;
  padding: 0;
  border-radius: 10px;
  border: 2px solid transparent;
  overflow: hidden;
  background: var(--surface-3);
  opacity: 0.7;
  transition: opacity 0.15s, border-color 0.15s;
}
.thumb.is-active {
  border-color: var(--primary);
  opacity: 1;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.description {
  margin-top: 10px;
  white-space: pre-line;
  color: var(--text-2);
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin: 18px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.facts dt {
  font-size: 0.76rem;
  color: var(--text-3);
}
.facts dd {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0 0;
  font-weight: 600;
}
.facts dd svg {
  width: 16px;
  height: 16px;
  color: var(--text-3);
}

.side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.price {
  font-size: clamp(1.7rem, 3vw, 2.1rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-top: 4px;
}
.nego {
  margin-top: -6px;
  color: var(--success);
  font-weight: 700;
  font-size: 0.86rem;
}
.title {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.35;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-bottom: 8px;
  font-size: 0.86rem;
  color: var(--text-2);
}
.meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.meta svg {
  width: 15px;
  height: 15px;
}
.meta__near {
  color: var(--primary);
  font-weight: 600;
}
.owner-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.safety {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-3);
}
.safety svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--success);
}
.seller {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.seller__heading {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
}
.seller__who {
  display: flex;
  align-items: center;
  gap: 12px;
}
.seller__who:hover strong {
  color: var(--primary);
}
.more {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}
.more__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

@media (min-width: 960px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
  .side {
    position: sticky;
    top: calc(var(--nav-h) + 24px);
  }
}
</style>
