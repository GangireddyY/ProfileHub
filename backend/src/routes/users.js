import { Router } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { CATEGORY_KEYS, RATE_UNITS, CURRENCIES } from '../constants/professions.js';
import { User, Listing } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastPresence } from '../socket/index.js';
import { buildSelf, decorateUsers, getConnectionIds, getConnectionCounts } from '../services/social.js';
import { listExperiences } from '../services/experiences.js';
import { assertProfession, activeProfessions, professionKeysInCategories } from '../services/professions.js';
import { userSearchClause } from '../services/search.js';
import { limitsFor, limitsByPlan, limitsFrom } from '../services/entitlements.js';
import { boundingBox, distanceBetween } from '../utils/geo.js';
import { validate, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const boolish = z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean());
const optionalNumber = (schema) => z.preprocess((v) => (v === '' || v == null ? undefined : v), schema.optional());
const csv = z
  .string()
  .optional()
  .default('')
  .transform((s) => s.split(',').map((p) => p.trim()).filter(Boolean));

const discoverSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  professions: csv,
  categories: csv.transform((list) => list.filter((c) => CATEGORY_KEYS.includes(c))),
  maxDistance: optionalNumber(z.coerce.number().positive().max(20000)),
  onlineOnly: boolish,
  availableOnly: boolish,
  maxRate: optionalNumber(z.coerce.number().int().positive().max(10_000_000)),
  sort: z.enum(['recommended', 'distance', 'newest', 'connections', 'rate']).optional().default('recommended'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

const idSchema = z.uuid('Invalid profile id');

export const profileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    headline: z.string().trim().max(160),
    profession: z.string().trim().min(1, 'Pick a profession').max(48),
    rateAmount: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.coerce.number().int('Use a whole number').min(1, 'Rate must be at least 1').max(10_000_000).nullable(),
    ),
    rateUnit: z.enum(RATE_UNITS),
    currency: z.enum(CURRENCIES),
    availableForWork: z.boolean(),
    roleTitle: z.string().trim().max(100),
    bio: z.string().trim().max(2000, 'Bio can be at most 2000 characters'),
    skills: z
      .array(z.string().trim().min(1).max(30, 'Each skill can be at most 30 characters'))
      .max(20, 'Add up to 20 skills')
      .transform((list) => [...new Map(list.map((s) => [s.toLowerCase(), s])).values()]),
    experienceYears: z.coerce.number().int().min(0).max(70),
    city: z.string().trim().max(100),
    contactEmail: z.union([z.literal(''), z.email('Enter a valid email address').max(160)]),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^$|^\+?[0-9][0-9\s-]{6,18}$/, 'Enter a valid mobile number, e.g. +91 98765 43210'),
    address: z.string().trim().max(300, 'Address can be at most 300 characters'),
  })
  .partial();

const settingsSchema = z
  .object({
    shareLocation: z.boolean(),
    showOnlineStatus: z.boolean(),
    discoverable: z.boolean(),
    discoveryRadiusKm: z.coerce.number().int().min(1).max(20000),
  })
  .partial();

const place = (max = 100) => z.string().trim().max(max).optional().default('');
const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  city: z.string().trim().max(100).optional(),
  details: z
    .object({
      road: place(),
      area: place(),
      city: place(),
      district: place(),
      state: place(),
      postcode: place(20),
      country: place(),
      countryCode: place(4),
      displayName: place(400),
      accuracy: z.coerce.number().min(0).max(1_000_000).nullable().optional().default(null),
    })
    .optional(),
});

/** Extra "Recommended" score for plans with priority placement: about one profession match. */
const PRIORITY_BOOST = 3;

function recommendationScore(me, user, distanceKm, categoryOf) {
  let score = 0;
  if (user.profession === me.profession) score += 3;
  else if (categoryOf.get(user.profession) === categoryOf.get(me.profession)) score += 1.5;
  if (user.visiblyOnline) score += 1.5;
  if (user.availableForWork) score += 0.5;
  if (distanceKm != null) score += Math.max(0, 2 - distanceKm / 50);
  const mySkills = new Set((me.skills || []).map((s) => s.toLowerCase()));
  for (const s of user.skills || []) if (mySkills.has(s.toLowerCase())) score += 0.5;
  return score;
}

router.get('/discover', async (req, res) => {
  const me = req.user;
  const f = validate(discoverSchema, req.query);

  const where = { id: { [Op.ne]: me.id }, discoverable: true, suspendedAt: null };
  const and = [];
  // Picked professions and categories widen each other (OR), like any multi-select filter.
  if (f.professions.length || f.categories.length) {
    const inCategories = f.categories.length ? await professionKeysInCategories(f.categories) : [];
    and.push({ profession: { [Op.in]: [...new Set([...f.professions, ...inCategories])] } });
  }
  if (f.onlineOnly) Object.assign(where, { isOnline: true, showOnlineStatus: true });
  if (f.availableOnly) where.availableForWork = true;
  if (f.maxRate != null) where.rateAmount = { [Op.ne]: null, [Op.lte]: f.maxRate };
  if (f.q) and.push(await userSearchClause(f.q));
  if (and.length) where[Op.and] = and;

  const distanceApplied = f.maxDistance != null && me.hasLocation;
  if (distanceApplied) {
    const box = boundingBox(me.latitude, me.longitude, f.maxDistance);
    where.shareLocation = true;
    where.latitude = { [Op.between]: [Math.max(box.minLat, -90), Math.min(box.maxLat, 90)] };
    // Skip the longitude window when it wraps around the antimeridian; haversine still filters exactly.
    if (box.minLng >= -180 && box.maxLng <= 180) {
      where.longitude = { [Op.between]: [box.minLng, box.maxLng] };
    } else {
      where.longitude = { [Op.ne]: null };
    }
  }

  const candidates = await User.findAll({ where, order: [['createdAt', 'DESC']], limit: 2000 });

  let rows = candidates.map((user) => ({ user, distanceKm: distanceBetween(me, user) }));
  if (distanceApplied) rows = rows.filter((r) => r.distanceKm != null && r.distanceKm <= f.maxDistance);

  if (f.sort === 'distance') {
    rows.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else if (f.sort === 'connections') {
    const counts = await getConnectionCounts(rows.map((r) => r.user.id));
    rows.sort((a, b) => (counts.get(b.user.id) || 0) - (counts.get(a.user.id) || 0));
  } else if (f.sort === 'rate') {
    rows.sort((a, b) => (a.user.rateAmount ?? Infinity) - (b.user.rateAmount ?? Infinity));
  } else if (f.sort === 'recommended') {
    const [professionList, planLimits] = await Promise.all([activeProfessions(), limitsByPlan()]);
    const categoryOf = new Map(professionList.map((p) => [p.key, p.category]));
    for (const r of rows) {
      r.score = recommendationScore(me, r.user, r.distanceKm, categoryOf);
      if (limitsFrom(planLimits, r.user).priorityInDiscover) r.score += PRIORITY_BOOST;
    }
    rows.sort((a, b) => b.score - a.score);
  }

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / f.limit));
  const pageRows = rows.slice((f.page - 1) * f.limit, f.page * f.limit);
  const items = await decorateUsers(me, pageRows.map((r) => r.user));

  res.json({
    items,
    total,
    page: f.page,
    pages,
    meta: { hasLocation: me.hasLocation, distanceApplied },
  });
});

router.patch('/me', async (req, res) => {
  const patch = validate(profileSchema, req.body);
  if (patch.profession !== undefined && patch.profession !== req.user.profession) await assertProfession(patch.profession);
  await req.user.update(patch);
  res.json({ user: await buildSelf(req.user) });
});

router.patch('/me/settings', async (req, res) => {
  const patch = validate(settingsSchema, req.body);
  const presenceChanged = patch.showOnlineStatus !== undefined && patch.showOnlineStatus !== req.user.showOnlineStatus;

  if (patch.shareLocation === false) {
    Object.assign(patch, { latitude: null, longitude: null, locationUpdatedAt: null, locationDetails: null });
  }
  await req.user.update(patch);
  if (presenceChanged) await broadcastPresence(req.user.id);

  res.json({ user: await buildSelf(req.user) });
});

router.put('/me/location', async (req, res) => {
  const { latitude, longitude, city, details } = validate(locationSchema, req.body);
  const patch = {
    latitude,
    longitude,
    shareLocation: true,
    locationUpdatedAt: new Date(),
    locationDetails: details ?? null,
  };
  // The profile city follows the shared location so it never contradicts the distance others see.
  if (city) patch.city = city;
  await req.user.update(patch);
  res.json({ user: await buildSelf(req.user) });
});

router.delete('/me/location', async (req, res) => {
  await req.user.update({
    latitude: null,
    longitude: null,
    locationUpdatedAt: null,
    locationDetails: null,
    shareLocation: false,
  });
  res.json({ user: await buildSelf(req.user) });
});

router.get('/:id', async (req, res) => {
  const id = validate(idSchema, req.params.id);
  const me = req.user;

  if (id === me.id) {
    const [self, experiences, listings] = await Promise.all([buildSelf(me), listExperiences(me.id), recentListings(me.id)]);
    return res.json({ user: { ...self, isMe: true, mutualCount: 0, mutualPreview: [], experiences, ...listings } });
  }

  const user = await User.findByPk(id);
  if (!user || (user.suspendedAt && !me.isAdmin)) throw notFound('This profile does not exist');

  const [[decorated], myIds, theirIds, experiences, listings] = await Promise.all([
    decorateUsers(me, [user]),
    getConnectionIds(me.id),
    getConnectionIds(user.id),
    listExperiences(user.id),
    recentListings(user.id),
  ]);
  const mutualIds = [...myIds].filter((x) => theirIds.has(x));
  const mutualPreview = mutualIds.length
    ? (await User.findAll({ where: { id: { [Op.in]: mutualIds.slice(0, 3) } } })).map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
      }))
    : [];

  const shareContact = decorated.connectionStatus === 'connected' || (await limitsFor(user)).showContactPublicly || me.isAdmin;
  const contact = shareContact ? user.toContact() : null;
  res.json({
    user: { ...decorated, isMe: false, contact, mutualCount: mutualIds.length, mutualPreview, experiences, ...listings },
  });
});

async function recentListings(sellerId) {
  const where = { sellerId, status: 'active' };
  const [rows, count] = await Promise.all([
    Listing.findAll({ where, order: [['createdAt', 'DESC']], limit: 6 }),
    Listing.count({ where }),
  ]);
  return { listings: rows.map((l) => l.toPublic()), listingCount: count };
}

export default router;
