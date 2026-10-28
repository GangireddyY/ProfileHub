<script setup>
import { ref, computed } from 'vue';
import { Search, ChevronRight } from 'lucide-vue-next';
import { useProfessionsStore } from '@/stores/professions';
import ProfessionDialog from './ProfessionDialog.vue';

/** Compact field: shows the current profession and opens the full-screen browser to change it. */
const model = defineModel({ type: String, default: '' });
defineProps({
  label: { type: String, default: '' },
  error: { type: String, default: '' },
  requestHandler: { type: Function, default: null },
  /** Show one-tap chips for common professions under the field. */
  quickPicks: { type: Boolean, default: true },
});

const QUICK = ['software', 'driver', 'electrician', 'teacher', 'daily_labour', 'nurse', 'plumber', 'delivery'];

const store = useProfessionsStore();
store.load().catch(() => {});

const open = ref(false);
const selected = computed(() => (model.value && model.value !== 'other' ? store.get(model.value) : null));
const quick = computed(() => QUICK.map((k) => store.list.find((p) => p.key === k)).filter(Boolean));
</script>

<template>
  <div class="picker">
    <span v-if="label" class="field__label">{{ label }}</span>

    <button
      type="button"
      class="trigger"
      :class="{ 'is-set': selected, 'has-error': error }"
      :style="selected ? { '--hue': selected.hue } : undefined"
      @click="open = true"
    >
      <span class="trigger__icon">
        <component :is="selected.icon" v-if="selected" />
        <Search v-else />
      </span>
      <span class="trigger__text">
        <strong>{{ selected?.label || 'Choose your profession' }}</strong>
        <small>{{ selected ? store.category(selected.category).label : `Search or browse ${store.list.length || 150} professions` }}</small>
      </span>
      <span class="trigger__action">{{ selected ? 'Change' : 'Browse' }} <ChevronRight /></span>
    </button>

    <div v-if="quickPicks && quick.length" class="quick">
      <button
        v-for="p in quick"
        :key="p.key"
        type="button"
        class="quick__pill"
        :class="{ 'is-active': model === p.key }"
        :style="{ '--hue': p.hue }"
        @click="model = p.key"
      >
        <component :is="p.icon" /> {{ p.label }}
      </button>
    </div>

    <p v-if="error" class="field__msg field__msg--error">{{ error }}</p>

    <ProfessionDialog v-model:open="open" v-model="model" :request-handler="requestHandler" />
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.trigger {
  --hue: 243;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1.5px dashed var(--border-strong);
  background: var(--surface);
  text-align: left;
  transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease), transform 0.15s var(--ease);
}
.trigger:hover {
  border-color: var(--primary);
  box-shadow: 0 10px 24px -16px color-mix(in srgb, var(--primary) 70%, transparent);
  transform: translateY(-1px);
}
.trigger.is-set {
  border-style: solid;
  border-color: hsl(var(--hue) 60% 55% / 0.45);
  background: hsl(var(--hue) 85% 55% / 0.06);
}
.trigger.has-error {
  border-color: var(--danger);
}
.trigger__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--primary-soft);
  color: var(--primary);
}
.trigger.is-set .trigger__icon {
  background: linear-gradient(135deg, hsl(var(--hue) 72% 58%), hsl(calc(var(--hue) + 28) 70% 48%));
  color: #fff;
}
.trigger__icon svg {
  width: 22px;
  height: 22px;
}
.trigger__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.trigger__text strong {
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trigger__text small {
  font-size: 0.8rem;
  color: var(--text-3);
}
.trigger__action {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  color: var(--primary);
  font-weight: 700;
  font-size: 0.86rem;
}
.trigger__action svg {
  width: 16px;
  height: 16px;
}
.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.quick__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 10px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-size: 0.8rem;
  font-weight: 600;
  transition: border-color 0.15s var(--ease), background-color 0.15s var(--ease);
}
.quick__pill svg {
  width: 14px;
  height: 14px;
  color: hsl(var(--hue) 65% 48%);
}
.quick__pill:hover {
  border-color: hsl(var(--hue) 60% 60%);
}
.quick__pill.is-active {
  border-color: hsl(var(--hue) 65% 52%);
  background: hsl(var(--hue) 65% 52%);
  color: #fff;
}
.quick__pill.is-active svg {
  color: #fff;
}
</style>
