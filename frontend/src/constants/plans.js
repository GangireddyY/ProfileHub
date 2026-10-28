import { formatMoney } from '@/utils/format';
import { MAX_LISTING_IMAGES } from '@/constants/marketplace';

/** What a plan can unlock; the API enforces each one. Mirrors backend/src/constants/planFeatures.js. */
export const FREE_LIMITS = {
  maxActiveListings: 3,
  maxListingPhotos: 4,
  messageAnyone: false,
  priorityInDiscover: false,
  verifiedBadge: false,
  featuredListings: false,
  showContactPublicly: false,
};

export const PLAN_TOGGLES = [
  { key: 'messageAnyone', label: 'Message anyone', description: 'Start chats with any member, not only connections and sellers.' },
  { key: 'priorityInDiscover', label: 'Priority in Discover', description: 'Ranked higher in “Recommended for you”.' },
  { key: 'verifiedBadge', label: 'Verified badge', description: 'A verified tick on their profile and cards.' },
  { key: 'featuredListings', label: 'Featured listings', description: 'Their listings appear first in the Market, marked “Featured”.' },
  { key: 'showContactPublicly', label: 'Public contact details', description: 'Email, mobile and address visible to everyone, not only connections.' },
];

export const MAX_PHOTOS = MAX_LISTING_IMAGES;

/** One line per feature, for plan cards: `{ label, included }`. */
export function featureRows(limits = FREE_LIMITS) {
  const l = { ...FREE_LIMITS, ...limits };
  const listings = l.maxActiveListings == null ? 'Unlimited active listings' : `Up to ${l.maxActiveListings} active listing${l.maxActiveListings === 1 ? '' : 's'}`;
  return [
    { key: 'listings', label: listings, included: l.maxActiveListings !== 0 },
    { key: 'photos', label: `${l.maxListingPhotos} photo${l.maxListingPhotos === 1 ? '' : 's'} per listing`, included: true },
    ...PLAN_TOGGLES.map((t) => ({ key: t.key, label: t.label, included: Boolean(l[t.key]) })),
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
