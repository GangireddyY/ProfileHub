<script setup>
import { ref, computed } from 'vue';
import { Search } from 'lucide-vue-next';
import { useProfessionsStore } from '@/stores/professions';
import { PROFESSION_ICONS } from '@/constants/professions';
import UiInput from '../ui/UiInput.vue';
import UiSelect from '../ui/UiSelect.vue';

/** { label, category, icon, hue } */
const model = defineModel({ type: Object, required: true });
defineProps({ errors: { type: Object, default: () => ({}) } });

const store = useProfessionsStore();
const iconQuery = ref('');
const categoryOptions = computed(() => store.categories.map((c) => ({ value: c.key, label: c.label })));
const icons = computed(() => {
  const q = iconQuery.value.trim().toLowerCase();
  return Object.entries(PROFESSION_ICONS).filter(([name]) => !q || name.toLowerCase().includes(q));
});
const set = (key, value) => (model.value = { ...model.value, [key]: value });

function pickCategory(key) {
  const c = store.category(key);
  // Follow the category colour unless the admin already customised it.
  const hueWasDefault = store.categories.some((x) => x.hue === model.value.hue);
  model.value = { ...model.value, category: key, ...(hueWasDefault ? { hue: c.hue } : {}) };
}
</script>

<template>
  <div class="pform">
    <div class="preview" :style="{ '--hue': model.hue }">
      <span class="preview__icon"><component :is="PROFESSION_ICONS[model.icon] || PROFESSION_ICONS.Briefcase" /></span>
      <div>
        <strong>{{ model.label || 'Profession name' }}</strong>
        <span class="preview__badge"><component :is="PROFESSION_ICONS[model.icon] || PROFESSION_ICONS.Briefcase" /> {{ model.label || 'Badge' }}</span>
      </div>
    </div>

    <UiInput :model-value="model.label" label="Name" maxlength="60" :error="errors.label" @update:model-value="set('label', $event)" />
    <UiSelect
      :model-value="model.category"
      label="Category"
      :options="categoryOptions"
      :error="errors.category"
      @update:model-value="pickCategory"
    />

    <div class="field">
      <span class="field__label">Colour</span>
      <input
        class="hue"
        type="range"
        min="0"
        max="359"
        :value="model.hue"
        aria-label="Colour"
        @input="set('hue', Number($event.target.value))"
      />
    </div>

    <div class="field">
      <span class="field__label">Icon</span>
      <label class="icon-search">
        <Search />
        <input v-model="iconQuery" type="search" placeholder="Filter icons (e.g. car, tool, heart)" aria-label="Filter icons" />
      </label>
      <div class="icons" role="radiogroup" aria-label="Icon">
        <button
          v-for="[name, icon] in icons"
          :key="name"
          type="button"
          role="radio"
          class="icon"
          :class="{ 'is-active': model.icon === name }"
          :aria-checked="model.icon === name"
          :title="name"
          :style="{ '--hue': model.hue }"
          @click="set('icon', name)"
        >
          <component :is="icon" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pform {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.preview {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: var(--radius);
  background: hsl(var(--hue) 85% 55% / 0.08);
  border: 1px solid hsl(var(--hue) 60% 55% / 0.3);
}
.preview strong {
  display: block;
  margin-bottom: 6px;
}
.preview__icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 15px;
  background: linear-gradient(135deg, hsl(var(--hue) 70% 58%), hsl(calc(var(--hue) + 30) 70% 50%));
  color: #fff;
}
.preview__icon svg {
  width: 26px;
  height: 26px;
}
.preview__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 99px;
  background: hsl(var(--hue) 85% 95%);
  color: hsl(var(--hue) 65% 38%);
  font-size: 0.76rem;
  font-weight: 700;
}
[data-theme='dark'] .preview__badge {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.preview__badge svg {
  width: 14px;
  height: 14px;
}
.hue {
  width: 100%;
  height: 14px;
  border-radius: 99px;
  appearance: none;
  background: linear-gradient(
    90deg,
    hsl(0 75% 55%),
    hsl(60 75% 55%),
    hsl(120 75% 45%),
    hsl(180 75% 45%),
    hsl(240 75% 60%),
    hsl(300 75% 55%),
    hsl(359 75% 55%)
  );
  cursor: pointer;
}
.hue::-webkit-slider-thumb {
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--text);
  box-shadow: var(--shadow-sm);
}
.hue::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--text);
}
.icon-search {
  position: relative;
  display: flex;
  align-items: center;
}
.icon-search svg {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: var(--text-3);
}
.icon-search input {
  width: 100%;
  height: 40px;
  padding: 0 12px 0 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 15px;
}
.icon-search input:focus {
  outline: none;
  border-color: var(--primary);
}
.icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
  padding: 2px;
}
.icon {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
}
.icon:hover {
  border-color: hsl(var(--hue) 60% 60%);
}
.icon svg {
  width: 18px;
  height: 18px;
}
.icon.is-active {
  border-color: hsl(var(--hue) 65% 52%);
  background: hsl(var(--hue) 65% 52%);
  color: #fff;
}
</style>
