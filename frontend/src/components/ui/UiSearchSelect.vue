<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { LayoutGrid, ChevronDown, Search, Check, X } from 'lucide-vue-next';

/**
 * Searchable multi-select dropdown.
 * `groups`: [{ key, title, options: [{ key, label, icon?, hue?, meta? }], searchOnly?, limit? }]
 * The model maps each group key to its selected option keys, e.g. { categories: ['tech'] }.
 * `searchOnly` groups are hidden until the user types.
 */
const model = defineModel({ type: Object, required: true });
const props = defineProps({
  groups: { type: Array, required: true },
  allLabel: { type: String, default: 'All' },
  placeholder: { type: String, default: 'Search' },
  icon: { type: [Object, Function], default: () => LayoutGrid },
});

const open = ref(false);
const query = ref('');
const root = ref(null);
const input = ref(null);

const term = computed(() => query.value.trim().toLowerCase());
const selectedOf = (groupKey) => model.value[groupKey] || [];

const visibleGroups = computed(() =>
  props.groups
    .filter((g) => term.value || !g.searchOnly)
    .map((g) => {
      const options = term.value ? g.options.filter((o) => o.label.toLowerCase().includes(term.value)) : g.options;
      return { ...g, options: g.limit ? options.slice(0, g.limit) : options };
    })
    .filter((g) => g.options.length),
);
const showTitles = computed(() => visibleGroups.value.length > 1);

const selectedCount = computed(() => props.groups.reduce((n, g) => n + selectedOf(g.key).length, 0));
const triggerLabel = computed(() => {
  if (!selectedCount.value) return props.allLabel;
  if (selectedCount.value > 1) return `${selectedCount.value} selected`;
  const group = props.groups.find((g) => selectedOf(g.key).length);
  const key = selectedOf(group.key)[0];
  return group.options.find((o) => o.key === key)?.label || key;
});

function toggle(groupKey, key) {
  const list = selectedOf(groupKey);
  model.value = { ...model.value, [groupKey]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] };
}
function clearAll() {
  model.value = Object.fromEntries(props.groups.map((g) => [g.key, []]));
}

watch(open, async (isOpen) => {
  if (!isOpen) return;
  query.value = '';
  await nextTick();
  input.value?.focus();
});

function onDocPointer(e) {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false;
}
function onKey(e) {
  if (e.key === 'Escape') open.value = false;
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div ref="root" class="sselect">
    <button
      type="button"
      class="sselect__trigger"
      :class="{ 'is-set': selectedCount }"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-label="`Filter: ${triggerLabel}`"
      @click="open = !open"
    >
      <component :is="icon" class="sselect__icon" />
      <span class="sselect__label">{{ triggerLabel }}</span>
      <span v-if="selectedCount" class="sselect__count">{{ selectedCount }}</span>
      <ChevronDown class="sselect__chevron" :class="{ 'is-open': open }" />
    </button>

    <Transition name="pop">
      <div v-if="open" class="sselect__panel">
        <label class="sselect__search">
          <Search />
          <input ref="input" v-model="query" type="search" :placeholder="placeholder" :aria-label="placeholder" />
        </label>

        <div class="sselect__list" role="listbox" aria-multiselectable="true">
          <button
            v-if="!term"
            type="button"
            class="option"
            :class="{ 'is-selected': !selectedCount }"
            role="option"
            :aria-selected="!selectedCount"
            @click="clearAll"
          >
            <span class="option__icon option__icon--all"><component :is="icon" /></span>
            <span class="option__label">{{ allLabel }}</span>
            <Check v-if="!selectedCount" class="option__check" />
          </button>

          <template v-for="g in visibleGroups" :key="g.key">
            <p v-if="showTitles" class="sselect__group">{{ g.title }}</p>
            <button
              v-for="o in g.options"
              :key="o.key"
              type="button"
              class="option"
              :class="{ 'is-selected': selectedOf(g.key).includes(o.key) }"
              :style="o.hue != null ? { '--hue': o.hue } : undefined"
              role="option"
              :aria-selected="selectedOf(g.key).includes(o.key)"
              @click="toggle(g.key, o.key)"
            >
              <span v-if="o.icon" class="option__icon"><component :is="o.icon" /></span>
              <span class="option__label">{{ o.label }}</span>
              <span v-if="o.meta != null" class="option__meta">{{ o.meta }}</span>
              <Check v-if="selectedOf(g.key).includes(o.key)" class="option__check" />
            </button>
          </template>

          <p v-if="term && !visibleGroups.length" class="sselect__empty">Nothing matches “{{ query.trim() }}”</p>
        </div>

        <div v-if="selectedCount" class="sselect__foot">
          <button type="button" class="sselect__clear" @click="clearAll"><X /> Clear selection</button>
          <button type="button" class="sselect__done" @click="open = false">Done</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sselect {
  position: relative;
  flex-shrink: 0;
}
.sselect__trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 50px;
  padding: 0 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--text-2);
  box-shadow: var(--shadow-xs);
  transition: border-color 0.15s var(--ease), color 0.15s var(--ease);
}
.sselect__trigger:hover,
.sselect__trigger[aria-expanded='true'] {
  border-color: var(--border-strong);
  color: var(--text);
}
.sselect__trigger.is-set {
  border-color: var(--primary);
  color: var(--primary);
}
.sselect__icon {
  width: 18px;
  height: 18px;
}
.sselect__label {
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sselect__count {
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: #fff;
  font-size: 0.72rem;
}
.sselect__chevron {
  width: 16px;
  height: 16px;
  transition: transform 0.15s var(--ease);
}
.sselect__chevron.is-open {
  transform: rotate(180deg);
}

.sselect__panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  width: min(340px, calc(100vw - 2 * var(--page-pad)));
  max-height: min(460px, calc(100dvh - var(--nav-h) - 140px));
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.sselect__search {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid var(--border);
}
.sselect__search svg {
  position: absolute;
  left: 20px;
  width: 16px;
  height: 16px;
  color: var(--text-3);
  pointer-events: none;
}
.sselect__search input {
  width: 100%;
  height: 38px;
  padding: 0 12px 0 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 0.9rem;
}
.sselect__search input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--surface);
}
.sselect__search input::-webkit-search-cancel-button {
  display: none;
}

.sselect__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
  scrollbar-width: thin;
}
.sselect__group {
  padding: 8px 10px 4px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
}
.sselect__empty {
  padding: 18px 10px;
  text-align: center;
  font-size: 0.86rem;
  color: var(--text-3);
}

.option {
  --hue: 243;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  font-size: 0.9rem;
  color: var(--text);
}
.option:hover {
  background: var(--surface-3);
}
.option.is-selected {
  background: var(--primary-soft);
}
.option__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: hsl(var(--hue) 85% 95%);
  color: hsl(var(--hue) 60% 45%);
}
[data-theme='dark'] .option__icon {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.option__icon--all {
  background: var(--primary-soft);
  color: var(--primary);
}
.option__icon svg {
  width: 15px;
  height: 15px;
}
.option__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.option__meta {
  flex-shrink: 0;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.76rem;
  color: var(--text-3);
}
.option__check {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--primary);
}

.sselect__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid var(--border);
}
.sselect__clear,
.sselect__done {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
}
.sselect__clear {
  background: transparent;
  color: var(--text-2);
}
.sselect__clear:hover {
  background: var(--surface-3);
}
.sselect__clear svg {
  width: 15px;
  height: 15px;
}
.sselect__done {
  background: var(--primary);
  color: var(--primary-text);
}
.sselect__done:hover {
  background: var(--primary-hover);
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.15s var(--ease), transform 0.15s var(--ease);
  transform-origin: top right;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(-4px);
}

@media (max-width: 599px) {
  .sselect__label,
  .sselect__chevron {
    display: none;
  }
}
</style>
