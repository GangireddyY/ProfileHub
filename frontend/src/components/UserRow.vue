<script setup>
import { computed } from 'vue';
import { useRealtimeStore } from '@/stores/realtime';
import UiAvatar from './ui/UiAvatar.vue';
import ProfessionBadge from './ProfessionBadge.vue';

const props = defineProps({
  user: { type: Object, required: true },
  subtitle: { type: String, default: '' },
  showBadge: Boolean,
});

const realtime = useRealtimeStore();
const online = computed(() => realtime.isOnline(props.user.id, props.user.online));
</script>

<template>
  <div class="urow">
    <RouterLink :to="`/u/${user.id}`" class="urow__link">
      <UiAvatar :name="user.name" :src="user.avatarUrl" :size="52" :online="online" />
      <div class="urow__text">
        <div class="row urow__name-row">
          <strong class="urow__name truncate">{{ user.name }}</strong>
          <ProfessionBadge v-if="showBadge" :profession="user.profession" size="sm" class="urow__badge" />
        </div>
        <p class="urow__role truncate">{{ user.roleTitle || user.headline }}</p>
        <p v-if="subtitle" class="urow__sub truncate">{{ subtitle }}</p>
      </div>
    </RouterLink>
    <div v-if="$slots.actions" class="urow__actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.urow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 4px;
}
.urow + .urow {
  border-top: 1px solid var(--border);
}
.urow__link {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.urow__text {
  min-width: 0;
  flex: 1;
}
.urow__name-row {
  gap: 8px;
  min-width: 0;
}
.urow__name {
  font-size: 0.98rem;
}
.urow__link:hover .urow__name {
  color: var(--primary);
}
.urow__role {
  color: var(--text-2);
  font-size: 0.86rem;
}
.urow__sub {
  color: var(--text-3);
  font-size: 0.78rem;
}
.urow__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
@media (max-width: 479px) {
  .urow {
    flex-wrap: wrap;
  }
  .urow__actions {
    width: 100%;
    padding-left: 64px;
  }
  .urow__actions > :deep(*) {
    flex: 1;
  }
  .urow__badge {
    display: none;
  }
}
</style>
