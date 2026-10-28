<script setup>
import { computed, useId } from 'vue';

const model = defineModel({ type: Number, default: 0 });
const props = defineProps({
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  label: { type: String, default: '' },
  format: { type: Function, default: null },
  marks: { type: Array, default: () => [] },
  disabled: Boolean,
});

const id = useId();
const pct = computed(() => ((model.value - props.min) / (props.max - props.min)) * 100);
const display = computed(() => (props.format ? props.format(model.value) : model.value));
</script>

<template>
  <div class="range" :class="{ 'is-disabled': disabled }">
    <div v-if="label" class="range__head">
      <label :for="id">{{ label }}</label>
      <strong>{{ display }}</strong>
    </div>
    <input
      :id="id"
      v-model.number="model"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :aria-valuetext="String(display)"
      :style="{ '--pct': `${pct}%` }"
    />
    <div v-if="marks.length" class="range__marks" aria-hidden="true">
      <span v-for="m in marks" :key="m">{{ m }}</span>
    </div>
  </div>
</template>

<style scoped>
.range {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.range.is-disabled {
  opacity: 0.5;
}
.range__head {
  display: flex;
  justify-content: space-between;
  font-size: 0.88rem;
  color: var(--text-2);
  font-weight: 600;
}
.range__head strong {
  color: var(--primary);
}
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 99px;
  background: linear-gradient(to right, var(--primary) var(--pct), var(--surface-3) var(--pct));
  outline: none;
  cursor: pointer;
  margin: 8px 0;
}
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s var(--ease);
}
input[type='range']::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
input[type='range']:active::-webkit-slider-thumb {
  transform: scale(1.15);
}
input[type='range']:focus-visible::-webkit-slider-thumb {
  box-shadow: var(--ring);
}
.range__marks {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--text-3);
}
</style>
