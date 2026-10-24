<script setup>
import { computed } from 'vue';
import { MapPin, Users, Navigation } from 'lucide-vue-next';
import { getProfession } from '@/constants/professions';
import { useRealtimeStore } from '@/stores/realtime';
import { formatDistance, formatCount } from '@/utils/format';
import UiAvatar from './ui/UiAvatar.vue';
import ProfessionBadge from './ProfessionBadge.vue';
import ConnectButton from './ConnectButton.vue';

const props = defineProps({ user: { type: Object, required: true } });
const emit = defineEmits(['change']);

const realtime = useRealtimeStore();
const hue = computed(() => getProfession(props.user.profession).hue);
const online = computed(() => realtime.isOnline(props.user.id, props.user.online));
</script>

<template>
  <article class="pcard" :style="{ '--hue': hue }">
    <div class="pcard__cover">
      <ProfessionBadge :profession="user.profession" size="sm" class="pcard__badge" />
    </div>

    <RouterLink :to="`/u/${user.id}`" class="pcard__main">
      <UiAvatar :name="user.name" :src="user.avatarUrl" :size="76" :online="online" ring class="pcard__avatar" />
      <h3 class="pcard__name truncate">{{ user.name }}</h3>
      <p class="pcard__role">{{ user.roleTitle || user.headline || 'Member' }}</p>

      <div class="pcard__meta">
        <span v-if="user.city" class="pcard__meta-item"><MapPin />{{ user.city }}</span>
        <span v-if="user.distanceKm != null" class="pcard__meta-item pcard__distance">
          <Navigation />{{ formatDistance(user.distanceKm) }}
        </span>
      </div>

      <div v-if="user.skills?.length" class="pcard__skills">
        <span v-for="s in user.skills.slice(0, 3)" :key="s" class="pcard__skill">{{ s }}</span>
        <span v-if="user.skills.length > 3" class="pcard__skill pcard__skill--more">+{{ user.skills.length - 3 }}</span>
      </div>
    </RouterLink>

    <footer class="pcard__foot">
      <span class="pcard__count"><Users />{{ formatCount(user.connectionCount) }} connections</span>
      <ConnectButton :user="user" size="sm" block @change="emit('change', $event)" />
    </footer>
  </article>
</template>

<style scoped>
.pcard {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: transform 0.22s var(--ease), box-shadow 0.22s var(--ease), border-color 0.22s var(--ease);
}
.pcard:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
  border-color: hsl(var(--hue) 60% 70% / 0.6);
}
.pcard__cover {
  position: relative;
  height: 72px;
  background: radial-gradient(120% 140% at 0% 0%, hsl(var(--hue) 85% 72%), transparent 60%),
    linear-gradient(135deg, hsl(var(--hue) 75% 58%), hsl(calc(var(--hue) + 35) 70% 55%));
}
.pcard__cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px);
  background-size: 14px 14px;
  mask-image: linear-gradient(to left, black, transparent 70%);
}
.pcard__badge {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  background: rgba(255, 255, 255, 0.92) !important;
  color: hsl(var(--hue) 65% 35%) !important;
  backdrop-filter: blur(6px);
}
.pcard__main {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 16px 14px;
  flex: 1;
}
.pcard__avatar {
  margin-top: -38px;
  margin-bottom: 10px;
}
.pcard__name {
  max-width: 100%;
  font-size: 1.02rem;
  font-weight: 700;
}
.pcard__role {
  color: var(--text-2);
  font-size: 0.86rem;
  min-height: 2.6em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.pcard__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 12px;
  margin-top: 8px;
  font-size: 0.8rem;
  color: var(--text-3);
}
.pcard__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.pcard__meta-item svg {
  width: 14px;
  height: 14px;
}
.pcard__distance {
  color: hsl(var(--hue) 60% 45%);
  font-weight: 600;
}
[data-theme='dark'] .pcard__distance {
  color: hsl(var(--hue) 80% 72%);
}
.pcard__skills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
}
.pcard__skill {
  font-size: 0.74rem;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 99px;
  background: var(--surface-3);
  color: var(--text-2);
}
.pcard__skill--more {
  background: transparent;
  border: 1px dashed var(--border-strong);
}
.pcard__foot {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--border);
}
.pcard__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--text-2);
  font-weight: 600;
}
.pcard__count svg {
  width: 15px;
  height: 15px;
}
</style>
