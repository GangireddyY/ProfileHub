import { reactive } from 'vue';

const state = reactive({ items: [] });
let seq = 0;

function push(type, message, opts = {}) {
  const id = ++seq;
  state.items.push({ id, type, message, title: opts.title, avatar: opts.avatar, action: opts.action });
  setTimeout(() => dismiss(id), opts.duration ?? 4000);
  return id;
}

function dismiss(id) {
  const i = state.items.findIndex((t) => t.id === id);
  if (i !== -1) state.items.splice(i, 1);
}

export const toast = {
  success: (msg, opts) => push('success', msg, opts),
  error: (msg, opts) => push('error', msg, opts),
  info: (msg, opts) => push('info', msg, opts),
  dismiss,
};

export function useToast() {
  return { toasts: state.items, ...toast };
}
