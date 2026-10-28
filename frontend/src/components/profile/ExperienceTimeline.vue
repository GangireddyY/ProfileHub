<script setup>
import { computed } from 'vue';
import { Briefcase, GraduationCap, Plus, Pencil, MapPin } from 'lucide-vue-next';
import { formatMonth, formatDuration } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';

const props = defineProps({
  kind: { type: String, required: true },
  items: { type: Array, default: () => [] },
  editable: Boolean,
  ownerName: { type: String, default: '' },
});
const emit = defineEmits(['add', 'edit']);

const isWork = computed(() => props.kind === 'work');
const list = computed(() => props.items.filter((e) => e.kind === props.kind));
</script>

<template>
  <UiCard v-if="list.length || editable">
    <header class="row-between head">
      <h2 class="section-title">{{ isWork ? 'Experience' : 'Education' }}</h2>
      <UiButton
        v-if="editable"
        variant="ghost"
        size="sm"
        :icon="Plus"
        icon-only
        :aria-label="isWork ? 'Add experience' : 'Add education'"
        @click="emit('add', kind)"
      />
    </header>

    <p v-if="!list.length" class="subtle empty">
      {{ isWork ? 'Add your roles so people know what you do.' : 'Add where you studied.' }}
    </p>

    <ol v-else class="timeline">
      <li v-for="e in list" :key="e.id" class="entry">
        <span class="entry__icon" :class="{ 'is-current': e.current }">
          <Briefcase v-if="isWork" />
          <GraduationCap v-else />
        </span>
        <div class="entry__body">
          <div class="row-between" style="align-items: flex-start">
            <div style="min-width: 0">
              <h3 class="entry__title">{{ e.title }}</h3>
              <p class="entry__org">{{ e.organization }}</p>
            </div>
            <UiButton
              v-if="editable"
              variant="ghost"
              size="sm"
              :icon="Pencil"
              icon-only
              aria-label="Edit entry"
              @click="emit('edit', e)"
            />
          </div>
          <p class="entry__dates">
            {{ formatMonth(e.startDate) }} – {{ e.current ? 'Present' : formatMonth(e.endDate) }}
            <span class="dot">·</span>
            {{ formatDuration(e.startDate, e.current ? null : e.endDate) }}
          </p>
          <p v-if="e.location" class="entry__loc"><MapPin /> {{ e.location }}</p>
          <p v-if="e.description" class="entry__desc">{{ e.description }}</p>
        </div>
      </li>
    </ol>
  </UiCard>
</template>

<style scoped>
.head {
  margin-bottom: 8px;
}
.empty {
  font-size: 0.9rem;
  margin-top: 4px;
}
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}
.entry {
  position: relative;
  display: flex;
  gap: 14px;
  padding: 12px 0;
}
.entry + .entry::before {
  content: '';
  position: absolute;
  left: 21px;
  top: -12px;
  height: 24px;
  width: 2px;
  background: var(--border);
}
.entry__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--surface-3);
  color: var(--text-2);
}
.entry__icon.is-current {
  background: var(--primary-soft);
  color: var(--primary);
}
.entry__icon svg {
  width: 20px;
  height: 20px;
}
.entry__body {
  flex: 1;
  min-width: 0;
}
.entry__title {
  font-size: 0.98rem;
  font-weight: 700;
}
.entry__org {
  color: var(--text);
  font-size: 0.9rem;
}
.entry__dates,
.entry__loc {
  color: var(--text-3);
  font-size: 0.82rem;
  margin-top: 2px;
}
.entry__loc {
  display: flex;
  align-items: center;
  gap: 4px;
}
.entry__loc svg {
  width: 13px;
  height: 13px;
}
.dot {
  margin: 0 4px;
}
.entry__desc {
  margin-top: 8px;
  color: var(--text-2);
  font-size: 0.9rem;
  white-space: pre-line;
}
</style>
