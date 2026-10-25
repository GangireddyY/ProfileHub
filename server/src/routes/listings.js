import { Router } from 'express';
import { Op } from 'sequelize';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Listing, User } from '../models/index.js';
import { LISTING_CATEGORIES, LISTING_CONDITIONS, LISTING_STATUSES, MAX_LISTING_IMAGES } from '../constants/marketplace.js';
import { CURRENCIES } from '../constants/professions.js';
import { requireAuth } from '../middleware/auth.js';
import { decorateUsers } from '../services/social.js';
import { listingSearchClause } from '../services/search.js';
import {
  saveListingImage,
  removeListingImages,
  MAX_LISTING_IMAGE_BYTES,
  LISTING_IMAGE_MIME_TYPES,
} from '../services/listingImages.js';
import { boundingBox, haversineKm } from '../utils/geo.js';
import { validate, badRequest, notFound, forbidden } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const MAX_ACTIVE_LISTINGS = 50;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LISTING_IMAGE_BYTES, files: MAX_LISTING_IMAGES },
  fileFilter: (req, file, cb) => {
    if (LISTING_IMAGE_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Upload JPG, PNG, WebP, GIF or AVIF photos'));
  },
});

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'You are posting too fast, please try again later' },
});

const boolish = z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean());
const optionalNumber = (schema) => z.preprocess((v) => (v === '' || v == null ? undefined : v), schema.optional());
const csvOf = (allowed) =>
  z
    .string()
    .optional()
    .default('')
    .transform((s) => s.split(',').map((v) => v.trim()).filter((v) => allowed.includes(v)));

const listingSchema = z.object({
  title: z.string({ error: 'Add a title' }).trim().min(3, 'Use at least 3 characters').max(100, 'Keep it under 100 characters'),
  description: z.string().trim().max(4000, 'Keep the description under 4000 characters').optional().default(''),
  category: z.enum(LISTING_CATEGORIES, { error: 'Pick a category' }),
  condition: z.enum(LISTING_CONDITIONS, { error: 'Pick the condition' }),
  price: z.coerce
    .number({ error: 'Enter a price' })
    .int('Use a whole number')
    .min(0, 'Price cannot be negative')
    .max(1_000_000_000_000, 'That price is too high'),
  currency: z.enum(CURRENCIES).optional().default('INR'),
  negotiable: boolish.optional().default(false),
  city: z.string().trim().max(100).optional().default(''),
});

const keepImagesSchema = z.preprocess((v) => {
  if (typeof v !== 'string') return v ?? [];
  try {
    return JSON.parse(v);
  } catch {
    return [];
  }
}, z.array(z.string().max(300)).max(MAX_LISTING_IMAGES));

const listSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  categories: csvOf(LISTING_CATEGORIES),
  conditions: csvOf(LISTING_CONDITIONS),
  minPrice: optionalNumber(z.coerce.number().int().min(0)),
  maxPrice: optionalNumber(z.coerce.number().int().min(0)),
  maxDistance: optionalNumber(z.coerce.number().positive().max(20000)),
  sellerId: z.uuid().optional(),
  status: z.enum([...LISTING_STATUSES, 'all']).optional().default('active'),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'distance']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(48).optional().default(24),
});

const idSchema = z.uuid('Invalid listing id');

function distanceTo(me, listing) {
  if (!me.hasLocation || listing.latitude == null || listing.longitude == null) return null;
  return Math.round(haversineKm(me.latitude, me.longitude, listing.latitude, listing.longitude) * 10) / 10;
}

function sellerSummary(user) {
  if (!user) return null;
  const p = user.toPublic();
  return { id: p.id, name: p.name, avatarUrl: p.avatarUrl, profession: p.profession, city: p.city, online: p.online };
}

async function findListing(id) {
  const row = await Listing.findByPk(validate(idSchema, id));
  if (!row) throw notFound('This listing does not exist');
  return row;
}

async function findOwnListing(req) {
  const row = await findListing(req.params.id);
  if (row.sellerId !== req.user.id) throw forbidden('You can only change your own listings');
  return row;
}

async function storeUploads(files = []) {
  const urls = [];
  try {
    for (const f of files) urls.push(await saveListingImage(f.buffer));
  } catch (err) {
    await removeListingImages(urls);
    throw err;
  }
  return urls;
}

const locationFor = (user) => (user.hasLocation ? { latitude: user.latitude, longitude: user.longitude } : {});

router.get('/', async (req, res) => {
  const me = req.user;
  const f = validate(listSchema, req.query);
  const mine = f.sellerId === me.id;

  const where = {};
  if (!mine || f.status !== 'all') where.status = mine ? f.status : 'active';
  if (f.sellerId) where.sellerId = f.sellerId;
  if (f.categories.length) where.category = { [Op.in]: f.categories };
  if (f.conditions.length) where.condition = { [Op.in]: f.conditions };
  if (f.minPrice != null || f.maxPrice != null) {
    where.price = {
      ...(f.minPrice != null ? { [Op.gte]: f.minPrice } : {}),
      ...(f.maxPrice != null ? { [Op.lte]: f.maxPrice } : {}),
    };
  }
  if (f.q) where[Op.and] = [listingSearchClause(f.q)];

  const distanceApplied = f.maxDistance != null && me.hasLocation;
  if (distanceApplied) {
    const box = boundingBox(me.latitude, me.longitude, f.maxDistance);
    where.latitude = { [Op.between]: [Math.max(box.minLat, -90), Math.min(box.maxLat, 90)] };
    where.longitude = box.minLng >= -180 && box.maxLng <= 180 ? { [Op.between]: [box.minLng, box.maxLng] } : { [Op.ne]: null };
  }

  const order = {
    newest: [['createdAt', 'DESC']],
    price_asc: [['price', 'ASC'], ['createdAt', 'DESC']],
    price_desc: [['price', 'DESC'], ['createdAt', 'DESC']],
    distance: [['createdAt', 'DESC']],
  }[f.sort];

  const candidates = await Listing.findAll({ where, order, limit: 2000, include: [{ model: User, as: 'seller' }] });
  let rows = candidates.map((listing) => ({ listing, distanceKm: distanceTo(me, listing) }));
  if (distanceApplied) rows = rows.filter((r) => r.distanceKm != null && r.distanceKm <= f.maxDistance);
  if (f.sort === 'distance') rows.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  const total = rows.length;
  const pageRows = rows.slice((f.page - 1) * f.limit, f.page * f.limit);
  res.json({
    items: pageRows.map(({ listing, distanceKm }) => ({
      ...listing.toPublic(),
      distanceKm,
      seller: sellerSummary(listing.seller),
    })),
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / f.limit)),
    meta: { hasLocation: me.hasLocation, distanceApplied },
  });
});

router.get('/:id', async (req, res) => {
  const me = req.user;
  const listing = await findListing(req.params.id);
  const isMine = listing.sellerId === me.id;
  if (!isMine && listing.status === 'archived') throw notFound('This listing is no longer available');
  if (!isMine) await listing.increment('viewCount');

  const seller = await User.findByPk(listing.sellerId);
  const [[decoratedSeller], more] = await Promise.all([
    seller ? decorateUsers(me, [seller]) : [null],
    Listing.findAll({
      where: { sellerId: listing.sellerId, status: 'active', id: { [Op.ne]: listing.id } },
      order: [['createdAt', 'DESC']],
      limit: 4,
    }),
  ]);

  res.json({
    listing: {
      ...listing.toPublic(),
      viewCount: listing.viewCount + (isMine ? 0 : 1),
      distanceKm: distanceTo(me, listing),
      isMine,
      seller: decoratedSeller,
    },
    moreFromSeller: more.map((l) => l.toPublic()),
  });
});

router.post('/', createLimiter, upload.array('images', MAX_LISTING_IMAGES), async (req, res) => {
  const data = validate(listingSchema, req.body);
  if ((await Listing.count({ where: { sellerId: req.user.id, status: 'active' } })) >= MAX_ACTIVE_LISTINGS) {
    throw badRequest(`You can have up to ${MAX_ACTIVE_LISTINGS} active listings`);
  }
  const images = await storeUploads(req.files);
  const listing = await Listing.create({
    ...data,
    city: data.city || req.user.city,
    ...locationFor(req.user),
    images,
    sellerId: req.user.id,
  });
  res.status(201).json({ listing: listing.toPublic() });
});

router.put('/:id', upload.array('images', MAX_LISTING_IMAGES), async (req, res) => {
  const listing = await findOwnListing(req);
  const data = validate(listingSchema, req.body);
  const keep = validate(keepImagesSchema, req.body.keepImages).filter((url) => listing.images.includes(url));
  if (keep.length + (req.files?.length || 0) > MAX_LISTING_IMAGES) {
    throw badRequest(`A listing can have up to ${MAX_LISTING_IMAGES} photos`);
  }

  const added = await storeUploads(req.files);
  const removed = listing.images.filter((url) => !keep.includes(url));

  // `order` lists kept URLs and "new:<index>" tokens so a fresh upload can become the cover photo.
  const order = validate(keepImagesSchema, req.body.order);
  const resolve = (token) => (token.startsWith('new:') ? added[Number(token.slice(4))] : keep.includes(token) ? token : null);
  const ordered = [...new Set(order.map(resolve).filter(Boolean))];
  const images = [...ordered, ...[...keep, ...added].filter((url) => !ordered.includes(url))];

  await listing.update({
    ...data,
    city: data.city || req.user.city,
    ...(listing.latitude == null ? locationFor(req.user) : {}),
    images,
  });
  await removeListingImages(removed);
  res.json({ listing: listing.toPublic() });
});

router.patch('/:id/status', async (req, res) => {
  const listing = await findOwnListing(req);
  const { status } = validate(z.object({ status: z.enum(LISTING_STATUSES) }), req.body);
  await listing.update({ status, soldAt: status === 'sold' ? listing.soldAt || new Date() : null });
  res.json({ listing: listing.toPublic() });
});

router.delete('/:id', async (req, res) => {
  const listing = await findOwnListing(req);
  const images = listing.images;
  await listing.destroy();
  await removeListingImages(images);
  res.status(204).end();
});

export default router;
