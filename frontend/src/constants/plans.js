import { formatMoney } from '@/utils/format';
import { MAX_LISTING_IMAGES } from '@/constants/marketplace';

/** What a plan can unlock; the API enforces each one. Mirrors backend/src/constants/planFeatures.js. */
export const FREE_LIMITS = {
  maxActiveListings: 3,
  maxListingPhotos: 4,
  maxChatPhotos: 1,
  maxDailyInvites: 20,
  messaging: true,
  messageAnyone: false,
  priorityInDiscover: false,
  verifiedBadge: false,
  featuredListings: false,
  showContactPublicly: false,
  emailAlerts: false,
  pushAlerts: true,
};

export const PLAN_TOGGLES = [
  {
    key: 'messaging',
    label: 'Messaging',
    description: 'Chat with connections, message sellers and reply to people who wrote first. Off blocks sending any message.',
  },
  {
    key: 'messageAnyone',
    label: 'Message anyone',
    description: 'Also start chats with members outside their network. Needs Messaging.',
    requires: 'messaging',
  },
  { key: 'priorityInDiscover', label: 'Priority in Discover', description: 'Ranked higher in “Recommended for you”.' },
  { key: 'verifiedBadge', label: 'Verified badge', description: 'A verified tick on their profile and cards.' },
  { key: 'featuredListings', label: 'Featured listings', description: 'Their listings appear first in the Market, marked “Featured”.' },
  { key: 'showContactPublicly', label: 'Public contact details', description: 'Email, mobile and address visible to everyone, not only connections.' },
  {
    key: 'emailAlerts',
    label: 'Email alerts',
    description: 'Emails for new messages, invitations, reviews and plan reminders. Account emails (approval, password reset) are always sent.',
  },
  { key: 'pushAlerts', label: 'Push notifications', description: 'Phone and browser notifications for messages, invitations and plan updates.' },
];

export const MAX_PHOTOS = MAX_LISTING_IMAGES;
export const MAX_CHAT_PHOTOS = 4;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** One line per feature, for plan cards: `{ label, included }`. */
export function featureRows(limits = FREE_LIMITS) {
  const l = { ...FREE_LIMITS, ...limits };
  const listings = l.maxActiveListings == null ? 'Unlimited active listings' : `Up to ${plural(l.maxActiveListings, 'active listing', 'active listings')}`;
  const invites = l.maxDailyInvites == null ? 'Unlimited invitations' : `${plural(l.maxDailyInvites, 'invitation', 'invitations')} a day`;
  const chatPhotos = l.maxChatPhotos ? `Send ${plural(l.maxChatPhotos, 'photo', 'photos')} per chat message` : 'Photos in chat';
  return [
    { key: 'listings', label: listings, included: l.maxActiveListings !== 0 },
    { key: 'photos', label: `${plural(l.maxListingPhotos, 'photo', 'photos')} per listing`, included: true },
    { key: 'chatPhotos', label: chatPhotos, included: l.maxChatPhotos > 0 },
    { key: 'invites', label: invites, included: true },
    ...PLAN_TOGGLES.map((t) => ({ key: t.key, label: t.label, included: Boolean(l[t.key]) && (!t.requires || Boolean(l[t.requires])) })),
  ];
}

export const PLAN_INTERVALS = [
  { value: 'month', label: 'Monthly', short: 'month' },
  { value: 'quarter', label: 'Every 3 months', short: '3 months' },
  { value: 'year', label: 'Yearly', short: 'year' },
  { value: 'lifetime', label: 'Lifetime (one-time)', short: 'lifetime' },
];

const SHORT = Object.fromEntries(PLAN_INTERVALS.map((i) => [i.value, i.short]));

/** "₹499 / month", "Free", or "₹4,999 lifetime". */
export function formatPlanPrice(plan) {
  if (!plan) return '';
  if (!plan.price) return plan.interval === 'lifetime' ? 'Free forever' : 'Free';
  const amount = formatMoney(plan.price, plan.currency);
  return plan.interval === 'lifetime' ? `${amount} lifetime` : `${amount} / ${SHORT[plan.interval] || plan.interval}`;
}

export function formatDate(date) {
  return date ? new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}
