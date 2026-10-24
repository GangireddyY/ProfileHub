<script setup>
import { ref, computed, useId } from 'vue';
import { Eye, EyeOff } from 'lucide-vue-next';

defineOptions({ inheritAttrs: false });

const model = defineModel({ type: [String, Number], default: '' });
const props = defineProps({
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
});

const id = useId();
const reveal = ref(false);
const inputType = computed(() => (props.type === 'password' && reveal.value ? 'text' : props.type));
const hasSuffix = computed(() => props.type === 'password');
</script>

<template>
  <div class="field" :class="[{ 'has-error': error }, $attrs.class]">
    <label v-if="label" :for="id" class="field__label">{{ label }}</label>
    <div class="field__control" :class="{ 'field__control--icon': icon, 'field__control--suffix': hasSuffix || $slots.suffix }">
      <component :is="icon" v-if="icon" class="field__icon" aria-hidden="true" />
      <input
        :id="id"
        v-model="model"
        v-bind="{ ...$attrs, class: undefined }"
        :type="inputType"
        class="field__input"
        :aria-invalid="Boolean(error) || undefined"
        :aria-describedby="error || hint ? `${id}-msg` : undefined"
      />
      <div v-if="hasSuffix || $slots.suffix" class="field__suffix">
        <slot name="suffix">
          <button
            type="button"
            class="field__suffix-btn"
            :aria-label="reveal ? 'Hide password' : 'Show password'"
            @click="reveal = !reveal"
          >
            <EyeOff v-if="reveal" />
            <Eye v-else />
          </button>
        </slot>
      </div>
    </div>
    <p v-if="error" :id="`${id}-msg`" class="field__msg field__msg--error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-msg`" class="field__msg">{{ hint }}</p>
  </div>
</template>
