<script setup>
import { ref, reactive, computed, watch, nextTick, onBeforeUnmount, useId } from 'vue';
import { Search, X, Flame, Check, PlusCircle, SearchX, Send, ArrowLeft, CornerDownLeft } from 'lucide-vue-next';
import { useProfessionsStore } from '@/stores/professions';
import { errorMessage, fieldErrors } from '@/api/http';
import UiButton from './ui/UiButton.vue';
import UiInput from './ui/UiInput.vue';
import UiSelect from './ui/UiSelect.vue';
import UiTextarea from './ui/UiTextarea.vue';

/** Full-screen profession browser: categories on the left, search + results on the right. */
const open = defineModel('open', { type: Boolean, default: false });
const model = defineModel({ type: String, default: '' });
const props = defineProps({
  requestHandler: { type: Function, default: null },
});

const POPULAR = [
  'software', 'driver', 'electrician', 'teacher', 'daily_labour', 'nurse', 'plumber', 'delivery',
  'housekeeper', 'carpenter', 'doctor', 'student', 'mechanic', 'security_guard', 'cook', 'accountant',
];

const store = useProfessionsStore();
const titleId = useId();
const input = ref(null);
const q = ref('');
const section = ref('popular');
const active = ref(0);

const term = computed(() => q.value.trim().toLowerCase());
const categories = computed(() =>
  store.categories
    .map((c) => ({ ...c, count: store.list.filter((p) => p.category === c.key).length }))
    .filter((c) => c.count),
);
const results = computed(() => {
  if (term.value) {
    return store.list
      .filter((p) => p.label.toLowerCase().includes(term.value))
      .sort((a, b) => a.label.toLowerCase().indexOf(term.value) - b.label.toLowerCase().indexOf(term.value));
  }
  if (section.value === 'popular') return POPULAR.map((k) => store.list.find((p) => p.key === k)).filter(Boolean);
  return store.list.filter((p) => p.category === section.value);
});
const heading = computed(() => {
  if (term.value) return `Results for “${q.value.trim()}”`;
  if (section.value === 'popular') return 'Popular professions';
  return store.category(section.value).label;
});

watch([term, section], () => (active.value = 0));

function pickSection(key) {
  section.value = key;
  q.value = '';
  requestOpen.value = false;
}

function choose(key) {
  model.value = key;
  open.value = false;
}

function onKey(e) {
  if (e.key === 'Escape') {
    if (requestOpen.value) requestOpen.value = false;
    else open.value = false;
  } else if (!requestOpen.value && results.value.length && ['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (e.key === 'Enter') return choose(results.value[active.value]?.key);
    const n = results.value.length;
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    nextTick(() => document.querySelector('.pd__item.is-focus')?.scrollIntoView({ block: 'nearest' }));
  }
}

watch(open, async (value) => {
  document.body.style.overflow = value ? 'hidden' : '';
  if (!value) return;
  q.value = '';
  requestOpen.value = false;
  section.value = model.value && model.value !== 'other' ? store.get(model.value).category : 'popular';
  store.load().catch(() => {});
  await nextTick();
  input.value?.focus();
  document.querySelector('.pd__nav-item.is-active')?.scrollIntoView({ block: 'center' });
});
onBeforeUnmount(() => (document.body.style.overflow = ''));

// ---------- Request a profession ----------
const requestOpen = ref(false);
const req = reactive({ label: '', category: 'other', note: '' });
const reqErrors = ref({});
const reqError = ref('');
const submitting = ref(false);
const categoryOptions = computed(() => store.categories.map((c) => ({ value: c.key, label: c.label })));
const existingMatch = computed(() => {
  const wanted = req.label.trim().toLowerCase();
  return wanted ? store.list.find((p) => p.label.toLowerCase() === wanted) : null;
});

function openRequest() {
  Object.assign(req, {
    label: q.value.trim(),
    category: section.value !== 'popular' ? section.value : 'other',
    note: '',
  });
  reqErrors.value = {};
  reqError.value = '';
  requestOpen.value = true;
}

async function sendRequest() {
  reqErrors.value = {};
  reqError.value = '';
  if (req.label.trim().length < 2) {
    reqErrors.value.label = 'Enter the profession name';
    return;
  }
  if (existingMatch.value) return;
  submitting.value = true;
  try {
    await props.requestHandler({ label: req.label.trim(), category: req.category, note: req.note.trim() });
    requestOpen.value = false;
    open.value = false;
  } catch (err) {
    reqErrors.value = fieldErrors(err);
    if (!reqErrors.value.label) reqError.value = errorMessage(err);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pd">
      <div v-if="open" class="pd" @keydown="onKey">
        <div class="pd__backdrop" @click="open = false" />
        <div class="pd__panel" role="dialog" aria-modal="true" :aria-labelledby="titleId">
          <header class="pd__head">
            <h2 :id="titleId" class="sr-only">Choose your profession</h2>
            <label class="pd__search">
              <Search class="pd__search-icon" aria-hidden="true" />
              <input
                ref="input"
                v-model="q"
                type="search"
                :placeholder="`Search ${store.list.length} professions…`"
                aria-label="Search professions"
                enterkeyhint="search"
                @input="requestOpen = false"
              />
              <kbd class="pd__kbd">Esc</kbd>
            </label>
            <button type="button" class="pd__close" aria-label="Close" @click="open = false"><X /></button>
          </header>

          <div class="pd__cats scroll-x" role="tablist" aria-label="Categories">
            <button type="button" class="pd__chip" :class="{ 'is-active': !term && section === 'popular' }" @click="pickSection('popular')">
              <Flame /> Popular
            </button>
            <button
              v-for="c in categories"
              :key="c.key"
              type="button"
              class="pd__chip"
              :class="{ 'is-active': !term && section === c.key }"
              :style="{ '--hue': c.hue }"
              @click="pickSection(c.key)"
            >
              <component :is="c.icon" /> {{ c.label }}
            </button>
          </div>

          <div class="pd__body">
            <nav class="pd__nav" aria-label="Categories">
              <button
                type="button"
                class="pd__nav-item"
                :class="{ 'is-active': !term && section === 'popular' }"
                style="--hue: 18"
                @click="pickSection('popular')"
              >
                <span class="pd__nav-icon"><Flame /></span>
                <span class="grow">Popular</span>
              </button>
              <button
                v-for="c in categories"
                :key="c.key"
                type="button"
                class="pd__nav-item"
                :class="{ 'is-active': !term && section === c.key }"
                :style="{ '--hue': c.hue }"
                @click="pickSection(c.key)"
              >
                <span class="pd__nav-icon"><component :is="c.icon" /></span>
                <span class="grow truncate">{{ c.label }}</span>
                <span class="pd__nav-count">{{ c.count }}</span>
              </button>
            </nav>

            <section class="pd__main">
              <template v-if="!requestOpen">
                <div class="pd__main-head">
                  <strong>{{ heading }}</strong>
                  <span class="subtle">{{ results.length }}</span>
                </div>
                <div v-if="results.length" class="pd__grid" role="listbox" :aria-label="heading">
                  <button
                    v-for="(p, i) in results"
                    :key="p.key"
                    type="button"
                    role="option"
                    class="pd__item"
                    :class="{ 'is-selected': model === p.key, 'is-focus': i === active }"
                    :aria-selected="model === p.key"
                    :style="{ '--hue': p.hue }"
                    @mouseenter="active = i"
                    @click="choose(p.key)"
                  >
                    <span class="pd__item-icon"><component :is="p.icon" /></span>
                    <span class="pd__item-text">
                      <strong>{{ p.label }}</strong>
                      <small v-if="term || section === 'popular'">{{ store.category(p.category).label }}</small>
                    </span>
                    <Check v-if="model === p.key" class="pd__item-check" />
                  </button>
                </div>
                <div v-else class="pd__empty">
                  <span class="pd__empty-icon"><SearchX /></span>
                  <strong>No profession called “{{ q.trim() }}” yet</strong>
                  <p class="muted">Ask us to add it. An admin reviews every request.</p>
                  <UiButton v-if="requestHandler" :icon="PlusCircle" @click="openRequest">Request “{{ q.trim() }}”</UiButton>
                </div>
              </template>

              <div v-else class="pd__request">
                <button type="button" class="pd__back" @click="requestOpen = false"><ArrowLeft /> Back to list</button>
                <div>
                  <h3 class="section-title">Request a new profession</h3>
                  <p class="muted">We'll notify you as soon as an admin adds it.</p>
                </div>
                <UiInput v-model="req.label" label="Profession name" placeholder="e.g. Drone Pilot" maxlength="60" :error="reqErrors.label" />
                <p v-if="existingMatch" class="pd__exists">
                  <strong>{{ existingMatch.label }}</strong> is already in the list.
                  <button type="button" @click="choose(existingMatch.key)">Select it</button>
                </p>
                <UiSelect v-model="req.category" label="Closest category" :options="categoryOptions" :error="reqErrors.category" />
                <UiTextarea
                  v-model="req.note"
                  label="What does this job involve? (optional)"
                  :maxlength="300"
                  :rows="3"
                  :error="reqErrors.note"
                />
                <p v-if="reqError" class="field__msg field__msg--error">{{ reqError }}</p>
                <div class="row" style="justify-content: flex-end">
                  <UiButton variant="ghost" @click="requestOpen = false">Cancel</UiButton>
                  <UiButton :icon="Send" :loading="submitting" :disabled="Boolean(existingMatch)" @click="sendRequest">Send request</UiButton>
                </div>
              </div>
            </section>
          </div>

          <footer class="pd__foot">
            <button v-if="requestHandler && !requestOpen" type="button" class="pd__request-link" @click="openRequest">
              <PlusCircle /> Can't find yours? Request a profession
            </button>
            <span class="pd__hint"><CornerDownLeft /> to select · ↑↓ to move</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pd {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 24px;
}
.pd__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(7, 11, 26, 0.55);
  backdrop-filter: blur(6px);
}
.pd__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(900px, 100%);
  height: min(640px, 100%);
  border-radius: 24px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.pd__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border-bottom: 1px solid var(--border);
}
.pd__search {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}
.pd__search-icon {
  position: absolute;
  left: 16px;
  width: 20px;
  height: 20px;
  color: var(--primary);
  pointer-events: none;
}
.pd__search input {
  width: 100%;
  height: 52px;
  padding: 0 64px 0 48px;
  border: 0;
  border-radius: 14px;
  background: var(--surface-2);
  font-size: 17px;
  font-weight: 500;
}
.pd__search input::-webkit-search-cancel-button {
  display: none;
}
.pd__search input:focus {
  outline: none;
  box-shadow: var(--ring);
}
.pd__kbd {
  position: absolute;
  right: 12px;
  padding: 3px 7px;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-3);
  font: 600 0.7rem var(--font);
}
.pd__close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--text-2);
}
.pd__close:hover {
  background: var(--surface-3);
  color: var(--text);
}
.pd__close svg {
  width: 20px;
  height: 20px;
}

.pd__cats {
  display: none;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.pd__chip {
  --hue: 18;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 34px;
  padding: 0 12px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
}
.pd__chip svg {
  width: 15px;
  height: 15px;
  color: hsl(var(--hue) 65% 50%);
}
.pd__chip.is-active {
  border-color: hsl(var(--hue) 65% 52%);
  background: hsl(var(--hue) 65% 52%);
  color: #fff;
}
.pd__chip.is-active svg {
  color: #fff;
}

.pd__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
}
.pd__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px;
  border-right: 1px solid var(--border);
  background: var(--surface-2);
  overflow-y: auto;
  scrollbar-width: none;
}
.pd__nav::-webkit-scrollbar {
  display: none;
}
.pd__nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 6px 10px 6px 6px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--text-2);
  font-size: 0.86rem;
  font-weight: 600;
  text-align: left;
  transition: background-color 0.15s var(--ease), color 0.15s var(--ease);
}
.pd__nav-item:hover {
  background: var(--surface-3);
  color: var(--text);
}
.pd__nav-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 8px;
  background: hsl(var(--hue) 85% 94%);
  color: hsl(var(--hue) 60% 42%);
}
[data-theme='dark'] .pd__nav-icon {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.pd__nav-icon svg {
  width: 15px;
  height: 15px;
}
.pd__nav-count {
  font-size: 0.74rem;
  color: var(--text-3);
}
.pd__nav-item.is-active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}
.pd__nav-item.is-active .pd__nav-icon {
  background: hsl(var(--hue) 65% 52%);
  color: #fff;
}

.pd__main {
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px 20px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}
.pd__main-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}
.pd__main-head strong {
  font-size: 1.02rem;
}
.pd__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 8px;
}
.pd__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border-radius: 14px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  text-align: left;
  transition: border-color 0.12s var(--ease), background-color 0.12s var(--ease), transform 0.12s var(--ease);
}
.pd__item.is-focus {
  border-color: hsl(var(--hue) 60% 60%);
  background: hsl(var(--hue) 85% 55% / 0.06);
}
.pd__item:active {
  transform: scale(0.98);
}
.pd__item-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 10px;
  background: hsl(var(--hue) 85% 94%);
  color: hsl(var(--hue) 60% 42%);
}
[data-theme='dark'] .pd__item-icon {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.pd__item-icon svg {
  width: 18px;
  height: 18px;
}
.pd__item-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.pd__item-text strong {
  font-size: 0.86rem;
  font-weight: 600;
}
.pd__item-text small {
  font-size: 0.72rem;
  color: var(--text-3);
}
.pd__item.is-selected {
  border-color: hsl(var(--hue) 65% 52%);
  background: hsl(var(--hue) 85% 52% / 0.1);
}
.pd__item.is-selected .pd__item-icon {
  background: hsl(var(--hue) 65% 52%);
  color: #fff;
}
.pd__item-check {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: hsl(var(--hue) 65% 45%);
}

.pd__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 16px;
  text-align: center;
}
.pd__empty-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 4px;
  border-radius: 18px;
  background: var(--surface-3);
  color: var(--text-3);
}
.pd__empty-icon svg {
  width: 26px;
  height: 26px;
}
.pd__empty p {
  margin-bottom: 8px;
}

.pd__request {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 480px;
}
.pd__back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.86rem;
}
.pd__back svg {
  width: 16px;
  height: 16px;
}
.pd__exists {
  margin-top: -6px;
  font-size: 0.84rem;
  color: var(--text-2);
}
.pd__exists button {
  border: 0;
  background: none;
  padding: 0;
  color: var(--primary);
  font-weight: 700;
}

.pd__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
}
.pd__request-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: none;
  padding: 4px 0;
  color: var(--primary);
  font-weight: 700;
  font-size: 0.86rem;
}
.pd__request-link svg,
.pd__hint svg {
  width: 15px;
  height: 15px;
}
.pd__hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.76rem;
  color: var(--text-3);
}

/* Phones: full-screen sheet with category chips instead of the sidebar. */
@media (max-width: 719px) {
  .pd {
    padding: 0;
    place-items: end stretch;
  }
  .pd__panel {
    width: 100%;
    height: 100%;
    border-radius: 0;
    border: 0;
  }
  .pd__body {
    grid-template-columns: minmax(0, 1fr);
  }
  .pd__nav,
  .pd__kbd,
  .pd__hint {
    display: none;
  }
  .pd__cats {
    display: flex;
    gap: 6px;
  }
  .pd__grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
  .pd__foot {
    padding-bottom: calc(10px + var(--safe-bottom));
  }
  .pd__search input {
    padding-right: 16px;
  }
}

.pd-enter-active,
.pd-leave-active {
  transition: opacity 0.2s var(--ease);
}
.pd-enter-active .pd__panel,
.pd-leave-active .pd__panel {
  transition: transform 0.25s var(--ease), opacity 0.2s var(--ease);
}
.pd-enter-from,
.pd-leave-to {
  opacity: 0;
}
.pd-enter-from .pd__panel,
.pd-leave-to .pd__panel {
  transform: translateY(16px) scale(0.98);
  opacity: 0;
}
</style>
