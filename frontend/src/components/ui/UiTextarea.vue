<script setup>
import { useId } from 'vue';

defineOptions({ inheritAttrs: false });

const model = defineModel({ type: String, default: '' });
defineProps({
  label: { type: String, default: '' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  maxlength: { type: Number, default: null },
  rows: { type: Number, default: 4 },
});

const id = useId();
</script>

<template>
  <div class="field" :class="[{ 'has-error': error }, $attrs.class]">
    <label v-if="label" :for="id" class="field__label">{{ label }}</label>
    <textarea
      :id="id"
      v-model="model"
      v-bind="{ ...$attrs, class: undefined }"
      :rows="rows"
      :maxlength="maxlength || undefined"
      class="field__input"
      :aria-invalid="Boolean(error) || undefined"
    />
    <div class="row">
      <p v-if="error" class="field__msg field__msg--error" role="alert">{{ error }}</p>
      <p v-else-if="hint" class="field__msg">{{ hint }}</p>
      <p v-if="maxlength" class="field__msg field__counter">{{ model.length }}/{{ maxlength }}</p>
    </div>
  </div>
</template>
