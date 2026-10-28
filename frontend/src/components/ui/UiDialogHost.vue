<script setup>
import { computed, ref, watch, nextTick, useId, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { TriangleAlert, CircleHelp, Trash2, Ban, MessageSquareText } from 'lucide-vue-next';
import { useDialogState } from '@/composables/useDialog';
import UiButton from './UiButton.vue';

const { t } = useI18n();
const { state, accept, cancel } = useDialogState();

const titleId = useId();
const messageId = useId();
const inputId = useId();
const field = ref(null);
const confirmBtn = ref(null);

const opts = computed(() => state.opts || {});
const tone = computed(() => opts.value.tone || 'primary');
const isPrompt = computed(() => state.kind === 'prompt');
const ICONS = { danger: Trash2, warning: TriangleAlert, block: Ban, prompt: MessageSquareText, primary: CircleHelp };
const icon = computed(() => opts.value.icon || ICONS[opts.value.iconKind] || (isPrompt.value && tone.value !== 'danger' ? ICONS.prompt : ICONS[tone.value]) || CircleHelp);

const canAccept = computed(() => {
  if (!isPrompt.value) return true;
  if (opts.value.match) return state.value.trim() === opts.value.match;
  if (opts.value.required) return Boolean(state.value.trim());
  return true;
});

function submit() {
  if (canAccept.value) accept();
}

function onKey(e) {
  if (!state.open) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    cancel();
  } else if (e.key === 'Enter' && !(isPrompt.value && opts.value.multiline) && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}

let restoreFocus = null;
watch(
  () => state.open,
  async (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      restoreFocus = document.activeElement;
      window.addEventListener('keydown', onKey);
      await nextTick();
      (isPrompt.value ? field.value : confirmBtn.value?.$el)?.focus?.();
      if (isPrompt.value && field.value?.select && state.value) field.value.select();
    } else {
      window.removeEventListener('keydown', onKey);
      restoreFocus?.focus?.();
    }
  },
);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="dlg">
      <div v-if="state.open" class="dlg-backdrop" @click.self="cancel">
        <div
          class="dlg"
          :class="`dlg--${tone}`"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="opts.message ? messageId : undefined"
        >
          <div class="dlg__body">
            <span class="dlg__icon" aria-hidden="true"><component :is="icon" /></span>
            <div class="dlg__text">
              <h2 :id="titleId" class="dlg__title">{{ opts.title || t('common.confirm') }}</h2>
              <p v-if="opts.message" :id="messageId" class="dlg__message">{{ opts.message }}</p>
            </div>
          </div>

          <div v-if="isPrompt" class="dlg__field">
            <label v-if="opts.label || opts.match" :for="inputId" class="dlg__label">
              <template v-if="opts.match">{{ t('common.typeToConfirm', { word: opts.match }) }}</template>
              <template v-else>{{ opts.label }}</template>
            </label>
            <textarea
              v-if="opts.multiline"
              :id="inputId"
              ref="field"
              v-model="state.value"
              class="dlg__input dlg__input--area"
              rows="3"
              :maxlength="opts.maxLength || 500"
              :placeholder="opts.placeholder || ''"
            />
            <input
              v-else
              :id="inputId"
              ref="field"
              v-model="state.value"
              class="dlg__input"
              :class="{ 'is-match': opts.match && canAccept }"
              type="text"
              autocomplete="off"
              spellcheck="false"
              :maxlength="opts.maxLength || 200"
              :placeholder="opts.match || opts.placeholder || ''"
            />
          </div>

          <footer class="dlg__foot">
            <UiButton variant="secondary" @click="cancel">{{ opts.cancelLabel || t('common.cancel') }}</UiButton>
            <UiButton
              ref="confirmBtn"
              :variant="tone === 'danger' || tone === 'block' ? 'danger' : 'primary'"
              :disabled="!canAccept"
              @click="submit"
            >
              {{ opts.confirmLabel || t('common.confirm') }}
            </UiButton>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dlg-backdrop {
  position: fixed;
  inset: 0;
  z-index: 250;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(8, 12, 28, 0.45);
}
.dlg {
  --tone: var(--primary);
  --tone-soft: var(--primary-soft);
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.dlg--danger,
.dlg--block {
  --tone: var(--danger);
  --tone-soft: var(--danger-soft);
}
.dlg--warning {
  --tone: var(--warning);
  --tone-soft: var(--warning-soft);
}
.dlg__body {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.dlg__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--tone-soft);
  color: var(--tone);
}
.dlg__icon svg {
  width: 21px;
  height: 21px;
}
.dlg__text {
  min-width: 0;
  padding-top: 2px;
}
.dlg__title {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.35;
}
.dlg__message {
  margin-top: 6px;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text-2);
  white-space: pre-line;
}
.dlg__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dlg__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-2);
}
.dlg__input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  font-size: 0.92rem;
  transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease), background-color 0.15s var(--ease);
}
.dlg__input--area {
  height: auto;
  min-height: 88px;
  padding: 10px 14px;
  resize: vertical;
}
.dlg__input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: var(--ring);
}
.dlg__input.is-match {
  border-color: var(--danger);
}
.dlg__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
/* The confirm action is the primary choice here, so danger is solid rather than the usual soft style. */
.dlg__foot :deep(.btn--danger) {
  background: var(--danger);
  color: #fff;
}
.dlg__foot :deep(.btn--danger:hover:not(:disabled)) {
  background: color-mix(in srgb, var(--danger) 88%, #000);
}
.dlg__foot :deep(.btn:disabled) {
  opacity: 0.45;
}

.dlg-enter-active,
.dlg-leave-active {
  transition: opacity 0.18s var(--ease);
}
.dlg-enter-active .dlg,
.dlg-leave-active .dlg {
  transition: transform 0.22s var(--ease), opacity 0.18s var(--ease);
}
.dlg-enter-from,
.dlg-leave-to {
  opacity: 0;
}
.dlg-enter-from .dlg,
.dlg-leave-to .dlg {
  transform: translateY(10px) scale(0.96);
  opacity: 0;
}

@media (max-width: 479px) {
  .dlg-backdrop {
    place-items: end center;
    padding: 12px;
  }
  .dlg__foot > * {
    flex: 1;
  }
}
</style>
