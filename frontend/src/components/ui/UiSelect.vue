<script setup>
import { useId } from 'vue';

defineOptions({ inheritAttrs: false });

const model = defineModel({ type: [String, Number], default: '' });
defineProps({
  label: { type: String, default: '' },
  /** [{ value, label }] */
  options: { type: Array, required: true },
  error: { type: String, default: '' },
});

const id = useId();
</script>

<template>
  <div class="field" :class="[{ 'has-error': error }, $attrs.class]">
    <label v-if="label" :for="id" class="field__label">{{ label }}</label>
    <select :id="id" v-model="model" v-bind="{ ...$attrs, class: undefined }" class="field__input">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <p v-if="error" class="field__msg field__msg--error" role="alert">{{ error }}</p>
  </div>
</template>
