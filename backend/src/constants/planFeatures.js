import { z } from 'zod';
import { MAX_LISTING_IMAGES } from './marketplace.js';

export const MAX_CHAT_PHOTOS = 4;
export const MAX_LISTING_LIMIT = 500;
export const MAX_DAILY_INVITES = 500;

/**
 * What a plan unlocks. Admins switch these per plan and the API enforces them.
 * `null` for a number means unlimited. Account emails (approval, password reset, suspension...)
 * are always sent; `emailAlerts`/`pushAlerts` only cover the optional alerts (messages, invitations, plans).
 */
export const FREE_LIMITS = Object.freeze({
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
});

/** Admins are never limited by a plan. */
export const ADMIN_LIMITS = Object.freeze({
  maxActiveListings: null,
  maxListingPhotos: MAX_LISTING_IMAGES,
  maxChatPhotos: MAX_CHAT_PHOTOS,
  maxDailyInvites: null,
  messaging: true,
  messageAnyone: true,
  priorityInDiscover: false,
  verifiedBadge: true,
  featuredListings: false,
  showContactPublicly: false,
  emailAlerts: true,
  pushAlerts: true,
});

/** The ready-made paid plans created on a fresh install (admins can edit or delete them). */
export const PRO_LIMITS = Object.freeze({
  maxActiveListings: 15,
  maxListingPhotos: 8,
  maxChatPhotos: 4,
  maxDailyInvites: 100,
  messaging: true,
  messageAnyone: true,
  priorityInDiscover: true,
  verifiedBadge: true,
  featuredListings: false,
  showContactPublicly: false,
  emailAlerts: true,
  pushAlerts: true,
});
export const BUSINESS_LIMITS = Object.freeze({
  maxActiveListings: null,
  maxListingPhotos: MAX_LISTING_IMAGES,
  maxChatPhotos: MAX_CHAT_PHOTOS,
  maxDailyInvites: null,
  messaging: true,
  messageAnyone: true,
  priorityInDiscover: true,
  verifiedBadge: true,
  featuredListings: true,
  showContactPublicly: true,
  emailAlerts: true,
  pushAlerts: true,
});

export const planLimitsSchema = z
  .object({
    maxActiveListings: z.coerce.number().int().min(0).max(MAX_LISTING_LIMIT).nullable(),
    maxListingPhotos: z.coerce.number().int().min(1).max(MAX_LISTING_IMAGES),
    maxChatPhotos: z.coerce.number().int().min(0).max(MAX_CHAT_PHOTOS),
    maxDailyInvites: z.coerce.number().int().min(1).max(MAX_DAILY_INVITES).nullable(),
    messaging: z.boolean(),
    messageAnyone: z.boolean(),
    priorityInDiscover: z.boolean(),
    verifiedBadge: z.boolean(),
    featuredListings: z.boolean(),
    showContactPublicly: z.boolean(),
    emailAlerts: z.boolean(),
    pushAlerts: z.boolean(),
  })
  .partial();

/** Fills gaps with the free defaults so older plans (or bad JSON) still behave predictably. */
export function normalizeLimits(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  const parsed = planLimitsSchema.safeParse(value && typeof value === 'object' ? value : {});
  return { ...FREE_LIMITS, ...(parsed.success ? parsed.data : {}) };
}
