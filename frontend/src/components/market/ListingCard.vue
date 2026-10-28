<script setup>
import { computed } from 'vue';
import { MapPin, Navigation, Images, Sparkles } from 'lucide-vue-next';
import { getListingCategory, conditionLabel } from '@/constants/marketplace';
import { formatMoney, formatDistance, timeAgo } from '@/utils/format';

const props = defineProps({
  listing: { type: Object, required: true },
  compact: Boolean,
});

const category = computed(() => getListingCategory(props.listing.category));
const cover = computed(() => props.listing.images?.[0] || '');
</script>

<template>
  <RouterLink :to="`/market/${listing.id}`" class="lcard" :class="{ 'lcard--compact': compact }" :style="{ '--hue': category.hue }">
    <div class="lcard__media">
      <img v-if="cover" :src="cover" :alt="listing.title" loading="lazy" />
      <div v-else class="lcard__placeholder">
        <component :is="category.icon" aria-hidden="true" />
      </div>
      <span v-if="listing.images?.length > 1" class="lcard__count"><Images /> {{ listing.images.length }}</span>
      <span v-if="listing.status !== 'active'" class="lcard__status">{{ listing.status === 'sold' ? 'Sold' : 'Hidden' }}</span>
      <span v-else-if="listing.featured" class="lcard__featured"><Sparkles /> Featured</span>
    </div>
    <div class="lcard__body">
      <div class="lcard__price">
        {{ listing.price ? formatMoney(listing.price, listing.currency) : 'Free' }}
        <span v-if="listing.negotiable" class="lcard__nego">Negotiable</span>
      </div>
      <h3 class="lcard__title">{{ listing.title }}</h3>
      <div class="lcard__meta">
        <span class="lcard__tag">{{ conditionLabel(listing.condition) }}</span>
        <span v-if="listing.distanceKm != null" class="lcard__place lcard__place--near"><Navigation />{{ formatDistance(listing.distanceKm) }}</span>
        <span v-else-if="listing.city" class="lcard__place"><MapPin />{{ listing.city }}</span>
      </div>
      <p v-if="!compact" class="lcard__time">{{ timeAgo(listing.createdAt) }}</p>
    </div>
  </RouterLink>
</template>

<style scoped>
.lcard {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: transform 0.22s var(--ease), box-shadow 0.22s var(--ease), border-color 0.22s var(--ease);
}
.lcard:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
  border-color: hsl(var(--hue) 60% 70% / 0.6);
}
.lcard__media {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--surface-3);
  overflow: hidden;
}
.lcard__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s var(--ease);
}
.lcard:hover .lcard__media img {
  transform: scale(1.04);
}
.lcard__placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: radial-gradient(120% 120% at 0% 0%, hsl(var(--hue) 85% 88%), transparent 60%),
    linear-gradient(135deg, hsl(var(--hue) 70% 94%), hsl(calc(var(--hue) + 30) 70% 88%));
  color: hsl(var(--hue) 55% 45%);
}
[data-theme='dark'] .lcard__placeholder {
  background: radial-gradient(120% 120% at 0% 0%, hsl(var(--hue) 60% 30% / 0.6), transparent 60%),
    linear-gradient(135deg, hsl(var(--hue) 40% 18%), hsl(calc(var(--hue) + 30) 40% 14%));
  color: hsl(var(--hue) 80% 72%);
}
.lcard__placeholder svg {
  width: 30%;
  height: 30%;
  stroke-width: 1.4;
  opacity: 0.85;
}
.lcard__count {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 99px;
  background: rgba(15, 23, 42, 0.65);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
}
.lcard__count svg {
  width: 12px;
  height: 12px;
}
.lcard__status {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 10px;
  border-radius: 99px;
  background: rgba(15, 23, 42, 0.8);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.lcard__featured {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 0 6px 14px -6px rgba(249, 115, 22, 0.7);
}
.lcard__featured svg {
  width: 12px;
  height: 12px;
}
.lcard__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px 14px;
  min-width: 0;
}
.lcard__price {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.lcard__nego {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 99px;
  background: var(--success-soft);
  color: var(--success);
}
.lcard__title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.5em;
}
.lcard__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 4px;
  font-size: 0.78rem;
  color: var(--text-3);
}
.lcard__tag {
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--surface-3);
  color: var(--text-2);
  font-weight: 600;
}
.lcard__place {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.lcard__place svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}
.lcard__place--near {
  color: var(--primary);
  font-weight: 600;
}
.lcard__time {
  font-size: 0.74rem;
  color: var(--text-3);
}
.lcard--compact .lcard__title {
  min-height: 0;
}
</style>
