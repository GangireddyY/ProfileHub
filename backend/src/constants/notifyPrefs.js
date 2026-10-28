import { z } from 'zod';

/** Groups members can switch on or off, separately for email and push. */
export const NOTIFY_CATEGORIES = ['messages', 'network', 'plans', 'account', 'admin'];
export const NOTIFY_CHANNELS = ['email', 'push'];

/** Which group each in-app notification belongs to. */
export const CATEGORY_OF_TYPE = {
  connection_request: 'network',
  connection_accepted: 'network',
  review_new: 'network',
  plan_approved: 'plans',
  plan_rejected: 'plans',
  plan_expiring: 'plans',
  plan_expired: 'plans',
  account_approved: 'account',
  profession_approved: 'account',
  profession_rejected: 'account',
  listing_removed: 'account',
  signup_request: 'admin',
  report_new: 'admin',
  plan_request: 'admin',
  profession_request: 'admin',
};

const channelSchema = z.object(Object.fromEntries(NOTIFY_CATEGORIES.map((c) => [c, z.boolean()]))).partial();
export const notifyPrefsSchema = z.object({ email: channelSchema, push: channelSchema }).partial();

/** Everything defaults to on; only explicit `false` turns a group off. */
export function normalizePrefs(prefs) {
  const out = {};
  for (const channel of NOTIFY_CHANNELS) {
    out[channel] = {};
    for (const category of NOTIFY_CATEGORIES) out[channel][category] = prefs?.[channel]?.[category] !== false;
  }
  return out;
}

export function wants(user, channel, category) {
  return normalizePrefs(user?.notifyPrefs)[channel][category];
}
