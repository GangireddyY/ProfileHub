import { api } from '@/api/http';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* push simply stays unavailable */
  });
}

async function registration() {
  if (!pushSupported()) return null;
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function keyToBytes(base64) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** { supported, enabled (server has keys), subscribed (this device), permission, devices } */
export async function pushStatus() {
  if (!pushSupported()) return { supported: false, enabled: false, subscribed: false, permission: 'default', devices: 0 };
  const sub = await currentSubscription();
  const { data } = await api.get('/push/config', { params: sub ? { endpoint: sub.endpoint } : {} });
  return {
    supported: true,
    enabled: data.enabled,
    publicKey: data.publicKey,
    subscribed: Boolean(sub && data.subscribed),
    permission: Notification.permission,
    devices: data.devices,
  };
}

/** Throws Error with `code`: unsupported | server_off | denied. */
export async function enablePush() {
  if (!pushSupported()) throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
  const { data } = await api.get('/push/config');
  if (!data.enabled || !data.publicKey) throw Object.assign(new Error('server_off'), { code: 'server_off' });
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw Object.assign(new Error('denied'), { code: 'denied' });
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(data.publicKey) });
  }
  await api.post('/push/subscriptions', sub.toJSON());
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api.delete('/push/subscriptions', { data: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/**
 * On sign-out, stop this browser receiving the previous member's notifications. The browser-level
 * subscription is only dropped when it belonged to this member, since another tab may be signed in as someone else.
 */
export async function forgetDevice() {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    const { data } = await api.delete('/push/subscriptions', { data: { endpoint: sub.endpoint } });
    if (data?.removed) await sub.unsubscribe();
  } catch {
    /* best effort */
  }
}
