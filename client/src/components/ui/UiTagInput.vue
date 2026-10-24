<script setup>
import { ref, useId } from 'vue';
import { X } from 'lucide-vue-next';

const model = defineModel({ type: Array, default: () => [] });
const props = defineProps({
  label: { type: String, default: '' },
  placeholder: { type: String, default: 'Type and press Enter' },
  max: { type: Number, default: 20 },
  maxLength: { type: Number, default: 30 },
  error: { type: String, default: '' },
});

const id = useId();
const draft = ref('');

function add() {
  const value = draft.value.trim().replace(/,$/, '').slice(0, props.maxLength);
  draft.value = '';
  if (!value || model.value.length >= props.max) return;
  if (model.value.some((t) => t.toLowerCase() === value.toLowerCase())) return;
  model.value = [...model.value, value];
}

function remove(i) {
  model.value = model.value.filter((_, idx) => idx !== i);
}

function onKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    add();
  } else if (e.key === 'Backspace' && !draft.value && model.value.length) {
    remove(model.value.length - 1);
  }
}
</script>

<template>
  <div class="field" :class="{ 'has-error': error }">
    <label v-if="label" :for="id" class="field__label">
      {{ label }} <span class="subtle">({{ model.length }}/{{ max }})</span>
    </label>
    <div class="tags field__input" @click="$refs.input.focus()">
      <TransitionGroup name="list">
        <span v-for="(tag, i) in model" :key="tag" class="tag">
          {{ tag }}
          <button type="button" class="tag__remove" :aria-label="`Remove ${tag}`" @click.stop="remove(i)"><X /></button>
        </span>
      </TransitionGroup>
      <input
        :id="id"
        ref="input"
        v-model="draft"
        :placeholder="model.length < max ? placeholder : 'Limit reached'"
        :disabled="model.length >= max"
        :maxlength="maxLength"
        enterkeyhint="done"
        @keydown="onKeydown"
        @blur="add"
      />
    </div>
    <p v-if="error" class="field__msg field__msg--error">{{ error }}</p>
  </div>
</template>

<style scoped>
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  height: auto;
  min-height: 46px;
  padding: 7px 8px;
  cursor: text;
}
.tags:focus-within {
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 6px 0 12px;
  border-radius: 99px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 0.85rem;
  font-weight: 600;
}
.tag__remove {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
}
.tag__remove:hover {
  background: color-mix(in srgb, var(--primary) 20%, transparent);
}
.tag__remove svg {
  width: 13px;
  height: 13px;
}
input {
  flex: 1;
  min-width: 120px;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 16px;
  padding: 0 6px;
}
</style>
