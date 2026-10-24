import { Router } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { sequelize, isPostgres } from '../config/db.js';
import { PROFESSIONS } from '../constants/professions.js';
import { User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastPresence } from '../socket/index.js';
import { buildSelf, decorateUsers, getConnectionIds, getConnectionCounts } from '../services/social.js';
import { boundingBox, distanceBetween } from '../utils/geo.js';
import { validate, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const boolish = z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean());
const optionalNumber = (schema) => z.preprocess((v) => (v === '' || v == null ? undefined : v), schema.optional());

const discoverSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  professions: z
    .string()
    .optional()
    .default('')
    .transform((s) => s.split(',').map((p) => p.trim()).filter((p) => PROFESSIONS.includes(p))),
  maxDistance: optionalNumber(z.coerce.number().positive().max(20000)),
  onlineOnly: boolish,
  sort: z.enum(['recommended', 'distance', 'newest', 'connections']).optional().default('recommended'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

const idSchema = z.uuid('Invalid profile id');

const profileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    headline: z.string().trim().max(160),
    profession: z.enum(PROFESSIONS),
    roleTitle: z.string().trim().max(100),
    bio: z.string().trim().max(2000, 'Bio can be at most 2000 characters'),
    skills: z
      .array(z.string().trim().min(1).max(30, 'Each skill can be at most 30 characters'))
      .max(20, 'Add up to 20 skills')
      .transform((list) => [...new Map(list.map((s) => [s.toLowerCase(), s])).values()]),
    experienceYears: z.coerce.number().int().min(0).max(70),
    city: z.string().trim().max(100),
    avatarUrl: z.union([z.literal(''), z.url({ protocol: /^https?$/, error: 'Use an http(s) image URL' }).max(500)]),
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

const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  city: z.string().trim().max(100).optional(),
});

function searchClause(q) {
  const like = isPostgres() ? Op.iLike : Op.like;
  const term = `%${q.replace(/[%_]/g, '')}%`;
  const castType = sequelize.getDialect() === 'mysql' ? 'CHAR' : 'TEXT';
  return {
    [Op.or]: [
      { name: { [like]: term } },
      { roleTitle: { [like]: term } },
      { headline: { [like]: term } },
      { city: { [like]: term } },
      sequelize.where(sequelize.cast(sequelize.col('skills'), castType), { [like]: term }),
    ],
  };
}

function recommendationScore(me, user, distanceKm) {
  let score = 0;
  if (user.profession === me.profession) score += 3;
  if (user.visiblyOnline) score += 1.5;
  if (distanceKm != null) score += Math.max(0, 2 - distanceKm / 50);
  const mySkills = new Set((me.skills || []).map((s) => s.toLowerCase()));
  for (const s of user.skills || []) if (mySkills.has(s.toLowerCase())) score += 0.5;
  return score;
}

router.get('/discover', async (req, res) => {
  const me = req.user;
  const f = validate(discoverSchema, req.query);

  const where = { id: { [Op.ne]: me.id }, discoverable: true };
  if (f.professions.length) where.profession = { [Op.in]: f.professions };
  if (f.onlineOnly) Object.assign(where, { isOnline: true, showOnlineStatus: true });
  if (f.q) where[Op.and] = [searchClause(f.q)];

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
  } else if (f.sort === 'recommended') {
    for (const r of rows) r.score = recommendationScore(me, r.user, r.distanceKm);
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
  await req.user.update(patch);
  res.json({ user: await buildSelf(req.user) });
});

router.patch('/me/settings', async (req, res) => {
  const patch = validate(settingsSchema, req.body);
  const presenceChanged = patch.showOnlineStatus !== undefined && patch.showOnlineStatus !== req.user.showOnlineStatus;

  if (patch.shareLocation === false) {
    Object.assign(patch, { latitude: null, longitude: null, locationUpdatedAt: null });
  }
  await req.user.update(patch);
  if (presenceChanged) await broadcastPresence(req.user.id);

  res.json({ user: await buildSelf(req.user) });
});

router.put('/me/location', async (req, res) => {
  const { latitude, longitude, city } = validate(locationSchema, req.body);
  const patch = { latitude, longitude, shareLocation: true, locationUpdatedAt: new Date() };
  if (city && !req.user.city) patch.city = city;
  await req.user.update(patch);
  res.json({ user: await buildSelf(req.user) });
});

router.delete('/me/location', async (req, res) => {
  await req.user.update({ latitude: null, longitude: null, locationUpdatedAt: null, shareLocation: false });
  res.json({ user: await buildSelf(req.user) });
});

router.get('/:id', async (req, res) => {
  const id = validate(idSchema, req.params.id);
  const me = req.user;

  if (id === me.id) {
    return res.json({ user: { ...(await buildSelf(me)), isMe: true, mutualCount: 0, mutualPreview: [] } });
  }

  const user = await User.findByPk(id);
  if (!user) throw notFound('This profile does not exist');

  const [[decorated], myIds, theirIds] = await Promise.all([
    decorateUsers(me, [user]),
    getConnectionIds(me.id),
    getConnectionIds(user.id),
  ]);
  const mutualIds = [...myIds].filter((x) => theirIds.has(x));
  const mutualPreview = mutualIds.length
    ? (await User.findAll({ where: { id: { [Op.in]: mutualIds.slice(0, 3) } } })).map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
      }))
    : [];

  res.json({ user: { ...decorated, isMe: false, mutualCount: mutualIds.length, mutualPreview } });
});

export default router;
