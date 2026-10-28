import { z } from 'zod';
import { MAX_LISTING_IMAGES } from './marketplace.js';

/**
 * What a plan unlocks. Admins switch these per plan and the API enforces them.
 * `maxActiveListings: null` means unlimited.
 */
export const FREE_LIMITS = Object.freeze({
  maxActiveListings: 3,
  maxListingPhotos: 4,
  messageAnyone: false,
  priorityInDiscover: false,
  verifiedBadge: false,
  featuredListings: false,
  showContactPublicly: false,
});

/** Admins are never limited by a plan. */
export const ADMIN_LIMITS = Object.freeze({
  maxActiveListings: null,
  maxListingPhotos: MAX_LISTING_IMAGES,
  messageAnyone: true,
  priorityInDiscover: false,
  verifiedBadge: true,
  featuredListings: false,
  showContactPublicly: false,
});

export const MAX_LISTING_LIMIT = 500;

export const planLimitsSchema = z
  .object({
    maxActiveListings: z.coerce.number().int().min(0).max(MAX_LISTING_LIMIT).nullable(),
    maxListingPhotos: z.coerce.number().int().min(1).max(MAX_LISTING_IMAGES),
    messageAnyone: z.boolean(),
    priorityInDiscover: z.boolean(),
    verifiedBadge: z.boolean(),
    featuredListings: z.boolean(),
    showContactPublicly: z.boolean(),
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
