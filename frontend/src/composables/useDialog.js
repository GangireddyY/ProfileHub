import { reactive } from 'vue';

/**
 * In-app replacement for window.confirm / window.prompt, rendered by <UiDialogHost /> in App.vue.
 *
 *   if (!(await dialog.confirm({ title, message, confirmLabel, tone: 'danger' }))) return;
 *   const note = await dialog.prompt({ title, message, label, multiline: true }); // null when cancelled
 *   await dialog.prompt({ ..., match: 'DELETE' }); // confirm stays disabled until the text matches
 */
const state = reactive({ open: false, kind: 'confirm', opts: {}, value: '' });
let resolver = null;

function settle(result) {
  const resolve = resolver;
  resolver = null;
  state.open = false;
  resolve?.(result);
}

function show(kind, opts = {}) {
  // Only one dialog at a time: a new one cancels whatever was still open.
  if (resolver) settle(state.kind === 'prompt' ? null : false);
  state.kind = kind;
  state.opts = opts;
  state.value = opts.initial ?? '';
  state.open = true;
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export const dialog = {
  confirm: (opts) => show('confirm', opts),
  prompt: (opts) => show('prompt', opts),
};

export function useDialogState() {
  return {
    state,
    accept: () => settle(state.kind === 'prompt' ? state.value : true),
    cancel: () => settle(state.kind === 'prompt' ? null : false),
  };
}
