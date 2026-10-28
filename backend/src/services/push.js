import crypto from 'node:crypto';
import webpush from 'web-push';
import { env } from '../config/env.js';
import { PushSubscription } from '../models/PushSubscription.js';

export const pushEnabled = () => Boolean(env.push.publicKey && env.push.privateKey);

if (pushEnabled()) {
  try {
    webpush.setVapidDetails(env.push.subject, env.push.publicKey, env.push.privateKey);
  } catch (err) {
    console.warn(`Push notifications are off: ${err.message}`);
    env.push.privateKey = '';
  }
}

export const endpointHash = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex');

/** Keep a member to a sensible number of devices; the oldest ones go first. */
const MAX_DEVICES = 10;

export async function saveSubscription(userId, { endpoint, keys }, userAgent = '') {
  const hash = endpointHash(endpoint);
  const existing = await PushSubscription.findOne({ where: { endpointHash: hash } });
  const fields = { userId, endpoint, endpointHash: hash, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent.slice(0, 300) };
  // A browser that signs in as someone else takes its subscription with it.
  if (existing) await existing.update(fields);
  else await PushSubscription.create(fields);

  const rows = await PushSubscription.findAll({ where: { userId }, order: [['updatedAt', 'DESC']], attributes: ['id'] });
  const extra = rows.slice(MAX_DEVICES).map((r) => r.id);
  if (extra.length) await PushSubscription.destroy({ where: { id: extra } });
}

export function removeSubscription(userId, endpoint) {
  return PushSubscription.destroy({ where: { userId, endpointHash: endpointHash(endpoint) } });
}

/**
 * payload: { title, body, url, tag }. Dead subscriptions (uninstalled browser, revoked permission)
 * are removed. Never throws.
 */
export async function sendPush(userId, payload) {
  if (!pushEnabled()) return 0;
  const subs = await PushSubscription.findAll({ where: { userId } });
  let delivered = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, urgency: 'normal' },
        );
        delivered += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) await sub.destroy();
        else console.warn(`Push to ${userId} failed: ${err.statusCode || ''} ${err.body || err.message}`);
      }
    }),
  );
  return delivered;
}
