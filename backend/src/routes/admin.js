import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User, Listing, ProfessionRequest, Plan, PlanRequest, Message, Connection, Notification } from '../models/index.js';
import { ROLES } from '../models/User.js';
import { PLAN_INTERVALS, planExpiry } from '../models/Plan.js';
import { PLAN_REQUEST_STATUSES } from '../models/PlanRequest.js';
import { planLimitsSchema, normalizeLimits } from '../constants/planFeatures.js';
import { defaultPlan } from '../services/plans.js';
import { notify } from '../services/notifications.js';
import { CATEGORY_KEYS, PROFESSION_ICONS, CURRENCIES } from '../constants/professions.js';
import { REQUEST_STATUSES } from '../models/ProfessionRequest.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  allProfessions,
  createProfession,
  updateProfession,
  approveRequest,
  rejectRequest,
  assertProfession,
} from '../services/professions.js';
import { getConnectionCounts } from '../services/social.js';
import { deleteAccount } from '../services/accounts.js';
import { likeOp, likeTerm } from '../services/search.js';
import { disconnectUser, broadcast } from '../socket/emitter.js';
import { profileSchema } from './users.js';
import { validate, notFound, badRequest, HttpError } from '../utils/http.js';

/** Admin-only routes, mounted at /api/admin. */
const router = Router();
router.use(requireAuth, requireAdmin);

const label = z.string().trim().min(2, 'Enter at least 2 characters').max(60, 'Keep it under 60 characters');
const professionFields = {
  label,
  category: z.enum(CATEGORY_KEYS, { error: 'Pick a category' }),
  icon: z.enum(PROFESSION_ICONS, { error: 'Pick an icon' }).optional(),
  hue: z.coerce.number().int().min(0).max(359).optional(),
};
const idSchema = z.uuid('Invalid id');

async function userCounts() {
  const rows = await User.findAll({
    attributes: ['profession', [fn('COUNT', col('id')), 'count']],
    group: ['profession'],
    raw: true,
  });
  return new Map(rows.map((r) => [r.profession, Number(r.count)]));
}

async function findRequest(id) {
  const row = await ProfessionRequest.findByPk(validate(idSchema, id));
  if (!row) throw notFound('Request not found');
  return row;
}

router.get('/stats', async (req, res) => {
  const fallback = await defaultPlan();
  const [users, admins, suspended, subscribers, plans, pendingPlanRequests, activeListings, pendingRequests, professions] = await Promise.all([
    User.count(),
    User.count({ where: { role: 'admin' } }),
    User.count({ where: { suspendedAt: { [Op.ne]: null } } }),
    // Members on a plan other than the default one.
    User.count({ where: { planId: fallback ? { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: fallback.id }] } : { [Op.ne]: null } } }),
    Plan.count({ where: { active: true } }),
    PlanRequest.count({ where: { status: 'pending' } }),
    Listing.count({ where: { status: 'active' } }),
    ProfessionRequest.count({ where: { status: 'pending' } }),
    allProfessions(),
  ]);
  res.json({
    users,
    admins,
    suspended,
    subscribers,
    plans,
    pendingPlanRequests,
    activeListings,
    pendingRequests,
    professions: professions.filter((p) => p.active).length,
    availableWorkers: await User.count({ where: { availableForWork: true } }),
  });
});

// ---------- Profession requests ----------
router.get('/profession-requests', async (req, res) => {
  const { status } = validate(
    z.object({ status: z.enum([...REQUEST_STATUSES, 'all']).optional().default('pending') }),
    req.query,
  );
  const rows = await ProfessionRequest.findAll({
    where: status === 'all' ? {} : { status },
    include: [
      { model: User, as: 'requester' },
      { model: User, as: 'reviewer' },
    ],
    order: [['createdAt', status === 'pending' ? 'ASC' : 'DESC']],
    limit: 200,
  });

  // How many people asked for the same name, so popular requests stand out.
  const pending = await ProfessionRequest.findAll({ where: { status: 'pending' }, attributes: ['label'], raw: true });
  const demand = new Map();
  for (const r of pending) demand.set(r.label.toLowerCase(), (demand.get(r.label.toLowerCase()) || 0) + 1);

  res.json({
    items: rows.map((r) => ({
      ...r.toPublic(),
      requester: r.requester?.toPublic() ?? null,
      reviewer: r.reviewer ? { id: r.reviewer.id, name: r.reviewer.name } : null,
      demand: demand.get(r.label.toLowerCase()) || 0,
    })),
  });
});

router.post('/profession-requests/:id/approve', async (req, res) => {
  const request = await findRequest(req.params.id);
  const data = validate(
    z.object({
      label: label.optional(),
      category: professionFields.category.optional(),
      icon: professionFields.icon,
      hue: professionFields.hue,
      assign: z.boolean().optional().default(true),
    }),
    req.body,
  );
  const result = await approveRequest(req.user, request, data);
  res.json(result);
});

router.post('/profession-requests/:id/reject', async (req, res) => {
  const request = await findRequest(req.params.id);
  const { note } = validate(z.object({ note: z.string().trim().max(300).optional().default('') }), req.body);
  await rejectRequest(req.user, request, note);
  res.json({ request: request.toPublic() });
});

// ---------- Catalog ----------
router.get('/professions', async (req, res) => {
  const [list, counts] = await Promise.all([allProfessions(), userCounts()]);
  res.json({ items: list.map((p) => ({ ...p, userCount: counts.get(p.key) || 0 })) });
});

router.post('/professions', async (req, res) => {
  const data = validate(z.object(professionFields), req.body);
  const profession = await createProfession({ ...data, createdById: req.user.id });
  res.status(201).json({ profession });
});

router.patch('/professions/:key', async (req, res) => {
  const key = validate(z.string().min(1).max(48), req.params.key);
  const patch = validate(
    z.object({ ...professionFields, active: z.boolean() }).partial(),
    req.body,
  );
  const profession = await updateProfession(key, patch);
  res.json({ profession });
});

// ---------- Users ----------
const userListSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  role: z.enum(['all', ...ROLES]).optional().default('all'),
  status: z.enum(['all', 'active', 'suspended']).optional().default('all'),
  plan: z.union([z.enum(['all', 'none']), z.uuid()]).optional().default('all'),
  sort: z.enum(['newest', 'oldest', 'name', 'lastSeen']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

const USER_SORTS = {
  newest: [['createdAt', 'DESC']],
  oldest: [['createdAt', 'ASC']],
  name: [['name', 'ASC']],
  lastSeen: [['isOnline', 'DESC'], ['lastSeenAt', 'DESC']],
};

const userEditSchema = profileSchema.extend({
  email: z.email('Enter a valid email address').max(160).optional(),
  role: z.enum(ROLES).optional(),
  discoverable: z.boolean().optional(),
  suspended: z.boolean().optional(),
  planId: z.uuid('Pick a plan').nullable().optional(),
  planExpiresAt: z.coerce.date().nullable().optional(),
});

/** Everything an admin may see about an account (never the password hash). */
function adminView(user) {
  return {
    ...user.toPublic(),
    email: user.email,
    role: user.role,
    discoverable: user.discoverable,
    suspendedAt: user.suspendedAt,
    isOnline: user.isOnline,
    lastSeenAt: user.lastSeenAt,
    contactEmail: user.contactEmail,
    phone: user.phone,
    address: user.address,
    planId: user.planId,
    planExpiresAt: user.planExpiresAt,
    plan: user.plan ? { id: user.plan.id, name: user.plan.name, interval: user.plan.interval } : null,
    updatedAt: user.updatedAt,
  };
}

async function findUser(id) {
  const user = await User.findByPk(validate(idSchema, id), { include: [{ model: Plan, as: 'plan' }] });
  if (!user) throw notFound('User not found');
  return user;
}

/** The env admin, yourself and the last remaining admin can't be locked out or removed. */
async function assertCanRestrict(admin, target, action) {
  if (target.id === admin.id) throw badRequest(`You can't ${action} your own account`);
  if (env.adminAccount.email && target.email === env.adminAccount.email) {
    throw badRequest(`The main admin account (ADMIN_EMAIL) can't be ${action === 'delete' ? 'deleted' : action === 'suspend' ? 'suspended' : 'demoted'}`);
  }
  if (target.role === 'admin' && (await User.count({ where: { role: 'admin', suspendedAt: null } })) <= 1) {
    throw badRequest('This is the last active admin');
  }
}

router.get('/users', async (req, res) => {
  const f = validate(userListSchema, req.query);
  const where = {};
  if (f.role !== 'all') where.role = f.role;
  if (f.status === 'active') where.suspendedAt = null;
  if (f.status === 'suspended') where.suspendedAt = { [Op.ne]: null };
  if (f.plan === 'none') where.planId = null;
  else if (f.plan !== 'all') where.planId = f.plan;
  if (f.q) {
    const like = likeOp();
    const term = likeTerm(f.q);
    where[Op.or] = [
      { name: { [like]: term } },
      { email: { [like]: term } },
      { city: { [like]: term } },
      { roleTitle: { [like]: term } },
      { phone: { [like]: term } },
    ];
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'interval'] }],
    order: USER_SORTS[f.sort],
    limit: f.limit,
    offset: (f.page - 1) * f.limit,
    distinct: true,
  });
  const ids = rows.map((u) => u.id);
  const [connections, listingRows] = await Promise.all([
    getConnectionCounts(ids),
    ids.length
      ? Listing.findAll({
          attributes: ['sellerId', [fn('COUNT', col('id')), 'count']],
          where: { sellerId: { [Op.in]: ids } },
          group: ['sellerId'],
          raw: true,
        })
      : [],
  ]);
  const listings = new Map(listingRows.map((r) => [r.sellerId, Number(r.count)]));

  res.json({
    items: rows.map((u) => ({ ...adminView(u), connectionCount: connections.get(u.id) || 0, listingCount: listings.get(u.id) || 0 })),
    total: count,
    page: f.page,
    pages: Math.max(1, Math.ceil(count / f.limit)),
  });
});

router.get('/users/:id', async (req, res) => {
  const user = await findUser(req.params.id);
  const id = user.id;
  const [connections, activeListings, totalListings, messagesSent, pendingRequests] = await Promise.all([
    getConnectionCounts([id]),
    Listing.count({ where: { sellerId: id, status: 'active' } }),
    Listing.count({ where: { sellerId: id } }),
    Message.count({ where: { senderId: id } }),
    Connection.count({ where: { addresseeId: id, status: 'pending' } }),
  ]);
  res.json({
    user: {
      ...adminView(user),
      locationCity: user.hasLocation ? user.locationDetails?.city || user.city : null,
      isMainAdmin: Boolean(env.adminAccount.email) && user.email === env.adminAccount.email,
    },
    stats: { connections: connections.get(id) || 0, activeListings, totalListings, messagesSent, pendingRequests },
  });
});

router.patch('/users/:id', async (req, res) => {
  const user = await findUser(req.params.id);
  const { suspended, planId, planExpiresAt, ...patch } = validate(userEditSchema, req.body);

  if (patch.profession !== undefined && patch.profession !== user.profession) await assertProfession(patch.profession);
  if (patch.email && patch.email.toLowerCase() !== user.email) {
    if (await User.count({ where: { email: patch.email.toLowerCase() } })) {
      throw new HttpError(409, 'Another account already uses this email', { fields: { email: 'Already in use' } });
    }
  }
  if (patch.role === 'member' && user.role === 'admin') await assertCanRestrict(req.user, user, 'demote');
  if (patch.role === user.role) delete patch.role;

  if (suspended === true && !user.suspendedAt) {
    await assertCanRestrict(req.user, user, 'suspend');
    Object.assign(patch, { suspendedAt: new Date(), isOnline: false });
  } else if (suspended === false) {
    patch.suspendedAt = null;
  }

  if (planId === null) {
    // "No plan" means back on the default plan.
    const fallback = await defaultPlan();
    Object.assign(patch, { planId: fallback?.id ?? null, planExpiresAt: null });
  } else if (planId !== undefined) {
    const plan = await Plan.findByPk(planId);
    if (!plan) throw badRequest('That plan no longer exists');
    const samePlan = planId === user.planId;
    patch.planId = planId;
    patch.planExpiresAt = planExpiresAt !== undefined ? planExpiresAt : samePlan ? user.planExpiresAt : planExpiry(plan.interval);
  } else if (planExpiresAt !== undefined && user.planId) {
    patch.planExpiresAt = planExpiresAt;
  }

  await user.update(patch);
  if (patch.suspendedAt) {
    disconnectUser(user.id);
    broadcast('presence', { userId: user.id, online: false, lastSeenAt: user.lastSeenAt });
  }
  res.json({ user: adminView(await findUser(user.id)) });
});

router.delete('/users/:id', async (req, res) => {
  const user = await findUser(req.params.id);
  await assertCanRestrict(req.user, user, 'delete');
  await deleteAccount(user);
  res.status(204).end();
});

// ---------- Plans ----------
const planSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(60),
  description: z.string().trim().max(300).optional().default(''),
  price: z.coerce.number().int('Use a whole number').min(0, 'Price cannot be negative').max(10_000_000),
  currency: z.enum(CURRENCIES).optional().default('INR'),
  interval: z.enum(PLAN_INTERVALS, { error: 'Pick a billing period' }),
  features: z
    .array(z.string().trim().min(1).max(80, 'Keep each feature under 80 characters'))
    .max(12, 'Add up to 12 features')
    .optional()
    .default([]),
  limits: planLimitsSchema.optional(),
  active: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional().default(0),
});

async function findPlan(id) {
  const plan = await Plan.findByPk(validate(idSchema, id));
  if (!plan) throw notFound('Plan not found');
  return plan;
}

/** Only one plan can be the default; making a plan the default unsets the previous one. */
async function applyDefault(plan, data, isNew = false) {
  if (plan.isDefault && data.isDefault === false) {
    throw badRequest('Make another plan the default instead. Every member needs a default plan to fall back to.');
  }
  if ((plan.isDefault || data.isDefault) && data.active === false) {
    throw badRequest("The default plan can't be hidden");
  }
  if (data.isDefault && (isNew || !plan.isDefault)) {
    await Plan.update({ isDefault: false }, { where: { isDefault: true } });
  }
}

router.get('/plans', async (req, res) => {
  const [plans, counts] = await Promise.all([
    Plan.findAll({ order: [['sortOrder', 'ASC'], ['price', 'ASC']] }),
    User.findAll({
      attributes: ['planId', [fn('COUNT', col('id')), 'count']],
      where: { planId: { [Op.ne]: null } },
      group: ['planId'],
      raw: true,
    }),
  ]);
  const subscribers = new Map(counts.map((r) => [r.planId, Number(r.count)]));
  res.json({ items: plans.map((p) => ({ ...p.toPublic(), subscriberCount: subscribers.get(p.id) || 0 })) });
});

router.post('/plans', async (req, res) => {
  const data = validate(planSchema, req.body);
  await applyDefault(Plan.build(), data, true);
  const plan = await Plan.create({ ...data, limits: normalizeLimits(data.limits) });
  res.status(201).json({ plan: { ...plan.toPublic(), subscriberCount: 0 } });
});

router.patch('/plans/:id', async (req, res) => {
  const plan = await findPlan(req.params.id);
  // Only fields that were sent: .partial() alone would still fill in the schema defaults.
  const data = Object.fromEntries(
    Object.entries(validate(planSchema.partial(), req.body)).filter(([key]) => key in req.body),
  );
  await applyDefault(plan, data);
  if (data.limits) data.limits = { ...normalizeLimits(plan.limits), ...data.limits };
  await plan.update(data);
  res.json({ plan: { ...plan.toPublic(), subscriberCount: await User.count({ where: { planId: plan.id } }) } });
});

router.delete('/plans/:id', async (req, res) => {
  const plan = await findPlan(req.params.id);
  if (plan.isDefault) throw badRequest("The default plan can't be deleted. Make another plan the default first.");
  const fallback = await defaultPlan();
  await User.update({ planId: fallback?.id ?? null, planExpiresAt: null }, { where: { planId: plan.id } });
  await plan.destroy();
  res.status(204).end();
});

// ---------- Plan requests ----------
const planRequestListSchema = z.object({
  status: z.enum([...PLAN_REQUEST_STATUSES, 'all']).optional().default('pending'),
});
const reviewSchema = z.object({
  note: z.string().trim().max(300, 'Keep the note under 300 characters').optional().default(''),
  expiresAt: z.coerce.date().nullable().optional(),
});

async function findPlanRequest(id) {
  const request = await PlanRequest.findByPk(validate(idSchema, id), { include: [{ model: Plan, as: 'plan' }] });
  if (!request) throw notFound('Request not found');
  if (request.status !== 'pending') throw badRequest('This request has already been reviewed');
  return request;
}

router.get('/plan-requests', async (req, res) => {
  const { status } = validate(planRequestListSchema, req.query);
  const rows = await PlanRequest.findAll({
    where: status === 'all' ? {} : { status },
    include: [
      { model: Plan, as: 'plan' },
      { model: User, as: 'requester', include: [{ model: Plan, as: 'plan' }] },
      { model: User, as: 'reviewer', attributes: ['id', 'name'] },
    ],
    order: [['createdAt', status === 'pending' ? 'ASC' : 'DESC']],
    limit: 200,
  });
  res.json({
    items: rows.map((r) => ({
      ...r.toPublic(),
      requester: r.requester
        ? { ...r.requester.toPublic(), email: r.requester.email, currentPlan: r.requester.plan?.toPublic() ?? null, planExpiresAt: r.requester.planExpiresAt }
        : null,
      reviewer: r.reviewer ? { id: r.reviewer.id, name: r.reviewer.name } : null,
    })),
  });
});

router.post('/plan-requests/:id/approve', async (req, res) => {
  const request = await findPlanRequest(req.params.id);
  const { note, expiresAt } = validate(reviewSchema, req.body);
  const member = await User.findByPk(request.userId);
  if (!member) throw notFound('This member no longer exists');

  await member.update({
    planId: request.planId,
    planExpiresAt: expiresAt !== undefined ? expiresAt : planExpiry(request.plan.interval),
  });
  await request.update({ status: 'approved', reviewNote: note, reviewedById: req.user.id, reviewedAt: new Date() });
  await Notification.update({ readAt: new Date() }, { where: { type: 'plan_request', entityId: request.id, readAt: null } });
  await notify({ userId: member.id, actorId: req.user.id, type: 'plan_approved', entityId: request.id });
  res.json({ request: request.toPublic() });
});

router.post('/plan-requests/:id/reject', async (req, res) => {
  const request = await findPlanRequest(req.params.id);
  const { note } = validate(reviewSchema, req.body);
  await request.update({ status: 'rejected', reviewNote: note, reviewedById: req.user.id, reviewedAt: new Date() });
  await Notification.update({ readAt: new Date() }, { where: { type: 'plan_request', entityId: request.id, readAt: null } });
  await notify({ userId: request.userId, actorId: req.user.id, type: 'plan_rejected', entityId: request.id });
  res.json({ request: request.toPublic() });
});

export default router;
