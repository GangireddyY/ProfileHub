import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  User,
  Listing,
  ProfessionRequest,
  Plan,
  PlanRequest,
  Message,
  Connection,
  Notification,
  Report,
  Review,
  AdminAction,
} from '../models/index.js';
import { AUDIT_TARGETS } from '../models/AdminAction.js';
import { logAdmin, diff, describeFields } from '../services/audit.js';
import { ratingSummaries, ratingSummary } from '../services/reviews.js';
import {
  sendAccountDeclinedEmail,
  sendSuspendedEmail,
  sendReactivatedEmail,
  sendVerificationEmail,
} from '../services/accountEmails.js';
import { adminExportLimiter } from '../middleware/limits.js';
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
import { broadcast } from '../socket/emitter.js';
import { revokeUserSessions } from '../services/sessions.js';
import { removeListingImages } from '../services/listingImages.js';
import { REPORT_STATUSES } from '../models/Report.js';
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
  const [pendingApprovals, openReports] = await Promise.all([
    User.count({ where: { approvalStatus: 'pending' } }),
    Report.count({ where: { status: 'open' } }),
  ]);
  res.json({
    users,
    admins,
    suspended,
    subscribers,
    plans,
    pendingPlanRequests,
    pendingApprovals,
    openReports,
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
  await logAdmin(req.user, 'profession_request.approved', {
    targetType: 'profession_request',
    targetId: request.id,
    targetLabel: request.label,
    summary: `Approved “${request.label}” as ${result.profession?.label ?? request.label}${result.resolved > 1 ? ` (${result.resolved} requests)` : ''}`,
  });
  res.json(result);
});

router.post('/profession-requests/:id/reject', async (req, res) => {
  const request = await findRequest(req.params.id);
  const { note } = validate(z.object({ note: z.string().trim().max(300).optional().default('') }), req.body);
  await rejectRequest(req.user, request, note);
  await logAdmin(req.user, 'profession_request.rejected', {
    targetType: 'profession_request',
    targetId: request.id,
    targetLabel: request.label,
    summary: `Declined “${request.label}”${note ? `: ${note}` : ''}`,
  });
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
  await logAdmin(req.user, 'profession.created', {
    targetType: 'profession',
    targetId: profession.key,
    targetLabel: profession.label,
    summary: `Added “${profession.label}” to the catalog`,
  });
  res.status(201).json({ profession });
});

router.patch('/professions/:key', async (req, res) => {
  const key = validate(z.string().min(1).max(48), req.params.key);
  const patch = validate(
    z.object({ ...professionFields, active: z.boolean() }).partial(),
    req.body,
  );
  const profession = await updateProfession(key, patch);
  const what =
    patch.active === false ? 'Hid' : patch.active === true && Object.keys(patch).length === 1 ? 'Restored' : `Edited ${describeFields(patch)} of`;
  await logAdmin(req.user, 'profession.updated', {
    targetType: 'profession',
    targetId: key,
    targetLabel: profession.label,
    summary: `${what} “${profession.label}”`,
    data: { patch },
  });
  res.json({ profession });
});

// ---------- Users ----------
const userListSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  role: z.enum(['all', ...ROLES]).optional().default('all'),
  status: z.enum(['all', 'active', 'suspended', 'pending', 'rejected']).optional().default('all'),
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
  approval: z.enum(['approved', 'rejected']).optional(),
  approvalNote: z.string().trim().max(300, 'Keep the note under 300 characters').optional(),
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
    approvalStatus: user.approvalStatus,
    approvalNote: user.approvalNote,
    emailVerifiedAt: user.emailVerifiedAt,
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

router.get('/users/export.csv', adminExportLimiter, (req, res) => exportUsersCsv(req, res));

router.get('/users', async (req, res) => {
  const f = validate(userListSchema, req.query);
  const { rows, count } = await User.findAndCountAll({
    where: userWhere(f),
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
  const [connections, activeListings, totalListings, messagesSent, pendingRequests, rating, openReports] = await Promise.all([
    getConnectionCounts([id]),
    Listing.count({ where: { sellerId: id, status: 'active' } }),
    Listing.count({ where: { sellerId: id } }),
    Message.count({ where: { senderId: id } }),
    Connection.count({ where: { addresseeId: id, status: 'pending' } }),
    ratingSummary(id),
    Report.count({ where: { targetUserId: id, status: 'open' } }),
  ]);
  res.json({
    user: {
      ...adminView(user),
      locationCity: user.hasLocation ? user.locationDetails?.city || user.city : null,
      isMainAdmin: Boolean(env.adminAccount.email) && user.email === env.adminAccount.email,
    },
    stats: { connections: connections.get(id) || 0, activeListings, totalListings, messagesSent, pendingRequests, rating, openReports },
  });
});

const planName = async (id) => (id ? (await Plan.findByPk(id, { attributes: ['name'] }))?.name ?? 'deleted plan' : 'none');

/** Plain-English summary of an account change, for the activity log. */
async function summarizeUserChange(before, changes) {
  const parts = [];
  if (changes.approvalStatus) parts.push(changes.approvalStatus[1] === 'approved' ? 'Approved the sign-up' : 'Declined the sign-up');
  if (changes.suspendedAt) parts.push(changes.suspendedAt[1] ? 'Suspended the account' : 'Lifted the suspension');
  if (changes.role) parts.push(`Changed role ${changes.role[0]} → ${changes.role[1]}`);
  if (changes.planId) parts.push(`Changed plan ${await planName(changes.planId[0])} → ${await planName(changes.planId[1])}`);
  else if (changes.planExpiresAt) parts.push('Changed the plan end date');
  const rest = Object.fromEntries(
    Object.entries(changes).filter(([k]) => !['approvalStatus', 'suspendedAt', 'role', 'planId', 'planExpiresAt', 'approvalNote'].includes(k)),
  );
  if (Object.keys(rest).length) parts.push(`Edited ${describeFields(rest)}`);
  if (!parts.length && changes.approvalNote) parts.push('Changed the approval note');
  return parts.join('; ');
}

function userAction(changes) {
  if (changes.approvalStatus) return changes.approvalStatus[1] === 'approved' ? 'user.approved' : 'user.rejected';
  if (changes.suspendedAt) return changes.suspendedAt[1] ? 'user.suspended' : 'user.reactivated';
  if (changes.role) return 'user.role_changed';
  if (changes.planId || changes.planExpiresAt) return 'user.plan_changed';
  return 'user.edited';
}

/** Shared by the single-account editor and bulk actions. Returns the reloaded account. */
async function applyUserChanges(admin, user, body) {
  const { suspended, approval, approvalNote, planId, planExpiresAt, ...patch } = validate(userEditSchema, body);
  const wasApproved = user.approvalStatus === 'approved';
  const before = user.get({ plain: true });

  if (approval === 'rejected' && user.approvalStatus !== 'rejected') {
    await assertCanRestrict(admin, user, 'suspend');
    Object.assign(patch, { approvalStatus: 'rejected', approvalNote: approvalNote ?? '' });
  } else if (approval === 'approved' && !wasApproved) {
    Object.assign(patch, { approvalStatus: 'approved', approvalNote: '' });
  } else if (approvalNote !== undefined) {
    patch.approvalNote = approvalNote;
  }

  if (patch.profession !== undefined && patch.profession !== user.profession) await assertProfession(patch.profession);
  if (patch.email && patch.email.toLowerCase() !== user.email) {
    if (await User.count({ where: { email: patch.email.toLowerCase() } })) {
      throw new HttpError(409, 'Another account already uses this email', { fields: { email: 'Already in use' } });
    }
  }
  const emailChanged = Boolean(patch.email && patch.email.toLowerCase() !== user.email);
  if (emailChanged) patch.emailVerifiedAt = null;
  if (patch.role === 'member' && user.role === 'admin') await assertCanRestrict(admin, user, 'demote');
  if (patch.role === user.role) delete patch.role;

  if (suspended === true && !user.suspendedAt) {
    await assertCanRestrict(admin, user, 'suspend');
    Object.assign(patch, { suspendedAt: new Date(), isOnline: false });
  } else if (suspended === false && user.suspendedAt) {
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

  if (patch.planId && patch.planId !== user.planId) patch.planReminderAt = null;

  const changes = diff(before, patch);
  await user.update(patch);
  if (patch.suspendedAt || patch.approvalStatus === 'rejected') {
    await revokeUserSessions(user.id);
    broadcast('presence', { userId: user.id, online: false, lastSeenAt: user.lastSeenAt });
  }
  if (patch.approvalStatus === 'approved' && !wasApproved) {
    await notify({ userId: user.id, actorId: admin.id, type: 'account_approved', entityId: user.id });
    await Notification.update({ readAt: new Date() }, { where: { type: 'signup_request', entityId: user.id, readAt: null } });
  }
  if (patch.approvalStatus === 'rejected') {
    await Notification.update({ readAt: new Date() }, { where: { type: 'signup_request', entityId: user.id, readAt: null } });
    sendAccountDeclinedEmail(user, patch.approvalNote);
  }
  if (patch.suspendedAt) sendSuspendedEmail(user);
  if (changes.suspendedAt && !patch.suspendedAt) sendReactivatedEmail(user);
  if (emailChanged) sendVerificationEmail(user);

  if (Object.keys(changes).length) {
    await logAdmin(admin, userAction(changes), {
      targetType: 'user',
      targetId: user.id,
      targetLabel: `${user.name} <${user.email}>`,
      summary: await summarizeUserChange(before, changes),
      data: { changes },
    });
  }
  return findUser(user.id);
}

router.patch('/users/:id', async (req, res) => {
  const user = await findUser(req.params.id);
  res.json({ user: adminView(await applyUserChanges(req.user, user, req.body)) });
});

async function removeUser(admin, user) {
  await assertCanRestrict(admin, user, 'delete');
  const label = `${user.name} <${user.email}>`;
  await deleteAccount(user);
  await logAdmin(admin, 'user.deleted', { targetType: 'user', targetId: user.id, targetLabel: label, summary: 'Deleted the account and everything it owned' });
}

router.delete('/users/:id', async (req, res) => {
  const user = await findUser(req.params.id);
  await removeUser(req.user, user);
  res.status(204).end();
});

// ---------- Bulk actions ----------
const BULK_ACTIONS = {
  approve: { approval: 'approved' },
  reject: { approval: 'rejected' },
  suspend: { suspended: true },
  reactivate: { suspended: false },
};
const bulkSchema = z.object({
  ids: z.array(idSchema).min(1, 'Select at least one account').max(100, 'Select up to 100 accounts at a time'),
  action: z.enum([...Object.keys(BULK_ACTIONS), 'plan', 'delete']),
  planId: z.uuid().nullable().optional(),
  note: z.string().trim().max(300).optional().default(''),
});

/** Runs the same checks as one-by-one edits; accounts that can't be changed are reported, not fatal. */
router.post('/users/bulk', async (req, res) => {
  const { ids, action, planId, note } = validate(bulkSchema, req.body);
  if (action === 'plan' && planId === undefined) throw badRequest('Pick a plan');
  const users = await User.findAll({ where: { id: { [Op.in]: [...new Set(ids)] } }, include: [{ model: Plan, as: 'plan' }] });
  const done = [];
  const failed = [];
  for (const user of users) {
    try {
      if (action === 'delete') await removeUser(req.user, user);
      else if (action === 'plan') await applyUserChanges(req.user, user, { planId });
      else await applyUserChanges(req.user, user, { ...BULK_ACTIONS[action], ...(action === 'reject' ? { approvalNote: note } : {}) });
      done.push(user.id);
    } catch (err) {
      failed.push({ id: user.id, name: user.name, message: err.status ? err.message : 'Something went wrong' });
    }
  }
  for (const id of ids) if (!users.some((u) => u.id === id)) failed.push({ id, name: 'Unknown', message: 'Account not found' });
  res.json({ done: done.length, failed });
});

// ---------- CSV exports ----------
const csvCell = (value) => {
  if (value == null) return '';
  let s = value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.join('; ') : String(value);
  // Stop spreadsheet apps from running values that look like formulas.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function sendCsv(res, name, columns, rows) {
  const lines = [columns.map(([title]) => csvCell(title)).join(',')];
  for (const row of rows) lines.push(columns.map(([, get]) => csvCell(get(row))).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  // BOM so Excel opens UTF-8 (Hindi/Kannada names) correctly.
  res.send(`\uFEFF${lines.join('\r\n')}\r\n`);
}

function userWhere(f) {
  const where = {};
  if (f.role !== 'all') where.role = f.role;
  if (f.status === 'active') Object.assign(where, { suspendedAt: null, approvalStatus: 'approved' });
  if (f.status === 'suspended') where.suspendedAt = { [Op.ne]: null };
  if (f.status === 'pending' || f.status === 'rejected') where.approvalStatus = f.status;
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
  return where;
}

const accountStatus = (u) => (u.suspendedAt ? 'suspended' : u.approvalStatus === 'approved' ? 'active' : u.approvalStatus);

async function exportUsersCsv(req, res) {
  const f = validate(userListSchema, req.query);
  const rows = await User.findAll({
    where: userWhere(f),
    include: [{ model: Plan, as: 'plan', attributes: ['name'] }],
    order: USER_SORTS[f.sort],
    limit: 10000,
  });
  const ids = rows.map((u) => u.id);
  const [connections, ratings] = await Promise.all([getConnectionCounts(ids), ratingSummaries(ids)]);
  sendCsv(
    res,
    'profilehub-users',
    [
      ['Name', (u) => u.name],
      ['Email', (u) => u.email],
      ['Email verified', (u) => (u.emailVerifiedAt ? 'yes' : 'no')],
      ['Role', (u) => u.role],
      ['Status', accountStatus],
      ['Plan', (u) => u.plan?.name ?? ''],
      ['Plan ends', (u) => u.planExpiresAt],
      ['Profession', (u) => u.profession],
      ['Role title', (u) => u.roleTitle],
      ['City', (u) => u.city],
      ['Phone', (u) => u.phone],
      ['Contact email', (u) => u.contactEmail],
      ['Available for work', (u) => (u.availableForWork ? 'yes' : 'no')],
      ['Rate', (u) => (u.rateAmount ? `${u.rateAmount} ${u.currency}/${u.rateUnit}` : '')],
      ['Connections', (u) => connections.get(u.id) || 0],
      ['Rating', (u) => ratings.get(u.id)?.average ?? ''],
      ['Reviews', (u) => ratings.get(u.id)?.count ?? 0],
      ['Joined', (u) => u.createdAt],
      ['Last seen', (u) => u.lastSeenAt],
      ['ID', (u) => u.id],
    ],
    rows,
  );
}

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
  await logAdmin(req.user, 'plan.created', {
    targetType: 'plan',
    targetId: plan.id,
    targetLabel: plan.name,
    summary: `Created plan ${plan.name} (${plan.price} ${plan.currency}/${plan.interval})`,
  });
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
  const changes = diff(plan.get({ plain: true }), data);
  await plan.update(data);
  if (Object.keys(changes).length) {
    await logAdmin(req.user, 'plan.updated', {
      targetType: 'plan',
      targetId: plan.id,
      targetLabel: plan.name,
      summary: `Edited ${describeFields(changes)}`,
      data: { changes },
    });
  }
  res.json({ plan: { ...plan.toPublic(), subscriberCount: await User.count({ where: { planId: plan.id } }) } });
});

router.delete('/plans/:id', async (req, res) => {
  const plan = await findPlan(req.params.id);
  if (plan.isDefault) throw badRequest("The default plan can't be deleted. Make another plan the default first.");
  const fallback = await defaultPlan();
  const [moved] = await User.update({ planId: fallback?.id ?? null, planExpiresAt: null }, { where: { planId: plan.id } });
  await plan.destroy();
  await logAdmin(req.user, 'plan.deleted', {
    targetType: 'plan',
    targetId: plan.id,
    targetLabel: plan.name,
    summary: `Deleted plan ${plan.name}${moved ? `; ${moved} member(s) moved to ${fallback?.name ?? 'no plan'}` : ''}`,
  });
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
    planReminderAt: null,
  });
  await request.update({ status: 'approved', reviewNote: note, reviewedById: req.user.id, reviewedAt: new Date() });
  await Notification.update({ readAt: new Date() }, { where: { type: 'plan_request', entityId: request.id, readAt: null } });
  await notify({
    userId: member.id,
    actorId: req.user.id,
    type: 'plan_approved',
    entityId: request.id,
    data: { planName: request.plan?.name, note, expiresAt: member.planExpiresAt },
  });
  await logAdmin(req.user, 'plan_request.approved', {
    targetType: 'user',
    targetId: member.id,
    targetLabel: `${member.name} <${member.email}>`,
    summary: `Approved a request for ${request.plan?.name ?? 'a plan'}${member.planExpiresAt ? ` until ${new Date(member.planExpiresAt).toDateString()}` : ''}`,
    data: { requestId: request.id, note },
  });
  res.json({ request: request.toPublic() });
});

router.post('/plan-requests/:id/reject', async (req, res) => {
  const request = await findPlanRequest(req.params.id);
  const { note } = validate(reviewSchema, req.body);
  await request.update({ status: 'rejected', reviewNote: note, reviewedById: req.user.id, reviewedAt: new Date() });
  await Notification.update({ readAt: new Date() }, { where: { type: 'plan_request', entityId: request.id, readAt: null } });
  await notify({
    userId: request.userId,
    actorId: req.user.id,
    type: 'plan_rejected',
    entityId: request.id,
    data: { planName: request.plan?.name, note },
  });
  const member = await User.findByPk(request.userId, { attributes: ['id', 'name', 'email'] });
  await logAdmin(req.user, 'plan_request.rejected', {
    targetType: 'user',
    targetId: request.userId,
    targetLabel: member ? `${member.name} <${member.email}>` : '',
    summary: `Declined a request for ${request.plan?.name ?? 'a plan'}${note ? `: ${note}` : ''}`,
    data: { requestId: request.id, note },
  });
  res.json({ request: request.toPublic() });
});


// ---------- Listing moderation ----------
const listingListSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  status: z.enum(['all', 'active', 'sold', 'archived']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(24),
});
const listingIdSchema = z.uuid('Invalid listing');
const moderationSchema = z.object({
  reason: z.string().trim().min(3, 'Tell the seller why, in a few words').max(300, 'Keep the reason under 300 characters'),
});

async function findAnyListing(id) {
  const listing = await Listing.findByPk(validate(listingIdSchema, id), { include: [{ model: User, as: 'seller' }] });
  if (!listing) throw notFound('Listing not found');
  return listing;
}

const listingView = (l, openReports = 0) => ({
  ...l.toPublic(),
  openReports,
  seller: l.seller ? { id: l.seller.id, name: l.seller.name, email: l.seller.email, avatarUrl: l.seller.avatarUrl, suspendedAt: l.seller.suspendedAt } : null,
});

router.get('/listings', async (req, res) => {
  const f = validate(listingListSchema, req.query);
  const where = {};
  if (f.status !== 'all') where.status = f.status;
  if (f.q) {
    const like = likeOp();
    const term = likeTerm(f.q);
    where[Op.or] = [{ title: { [like]: term } }, { description: { [like]: term } }, { city: { [like]: term } }];
  }
  const { rows, count } = await Listing.findAndCountAll({
    where,
    include: [{ model: User, as: 'seller' }],
    order: [['createdAt', 'DESC']],
    limit: f.limit,
    offset: (f.page - 1) * f.limit,
    distinct: true,
  });
  const reportRows = rows.length
    ? await Report.findAll({
        attributes: ['targetId', [fn('COUNT', col('id')), 'count']],
        where: { targetType: 'listing', status: 'open', targetId: { [Op.in]: rows.map((l) => l.id) } },
        group: ['targetId'],
        raw: true,
      })
    : [];
  const reports = new Map(reportRows.map((r) => [r.targetId, Number(r.count)]));
  res.json({
    items: rows.map((l) => listingView(l, reports.get(l.id) || 0)),
    total: count,
    page: f.page,
    pages: Math.max(1, Math.ceil(count / f.limit)),
  });
});

/** Hide (archive) or restore a listing; hiding tells the seller why. */
router.patch('/listings/:id', async (req, res) => {
  const listing = await findAnyListing(req.params.id);
  const { status, reason } = validate(
    z.object({ status: z.enum(['active', 'archived']), reason: z.string().trim().max(300).optional().default('') }),
    req.body,
  );
  if (status === 'archived' && reason.length < 3) throw badRequest('Tell the seller why the listing is being hidden');
  await listing.update({ status });
  if (status === 'archived') {
    await notify({
      userId: listing.sellerId,
      type: 'listing_removed',
      entityId: listing.id,
      data: { title: listing.title, reason, action: 'hidden' },
    });
  }
  await logAdmin(req.user, status === 'archived' ? 'listing.hidden' : 'listing.restored', {
    targetType: 'listing',
    targetId: listing.id,
    targetLabel: `${listing.title} (by ${listing.seller?.name ?? 'unknown'})`,
    summary: status === 'archived' ? `Hid the listing: ${reason}` : 'Restored the listing',
    data: { sellerId: listing.sellerId },
  });
  res.json({ listing: listingView(listing) });
});

router.delete('/listings/:id', async (req, res) => {
  const listing = await findAnyListing(req.params.id);
  const { reason } = validate(moderationSchema, req.body || {});
  const { images, title, sellerId } = listing;
  await listing.destroy();
  await removeListingImages(images);
  await notify({ userId: sellerId, type: 'listing_removed', data: { title, reason, action: 'deleted' } });
  await logAdmin(req.user, 'listing.deleted', {
    targetType: 'listing',
    targetId: listing.id,
    targetLabel: `${title} (by ${listing.seller?.name ?? 'unknown'})`,
    summary: `Deleted the listing: ${reason}`,
    data: { sellerId },
  });
  res.status(204).end();
});

router.get('/listings/export.csv', adminExportLimiter, async (req, res) => {
  const f = validate(listingListSchema.omit({ page: true, limit: true }), req.query);
  const where = {};
  if (f.status !== 'all') where.status = f.status;
  if (f.q) {
    const like = likeOp();
    const term = likeTerm(f.q);
    where[Op.or] = [{ title: { [like]: term } }, { description: { [like]: term } }, { city: { [like]: term } }];
  }
  const rows = await Listing.findAll({ where, include: [{ model: User, as: 'seller' }], order: [['createdAt', 'DESC']], limit: 10000 });
  sendCsv(
    res,
    'profilehub-listings',
    [
      ['Title', (l) => l.title],
      ['Status', (l) => l.status],
      ['Category', (l) => l.category],
      ['Condition', (l) => l.condition],
      ['Price', (l) => l.price],
      ['Currency', (l) => l.currency],
      ['City', (l) => l.city],
      ['Photos', (l) => l.images?.length ?? 0],
      ['Seller', (l) => l.seller?.name ?? ''],
      ['Seller email', (l) => l.seller?.email ?? ''],
      ['Created', (l) => l.createdAt],
      ['Updated', (l) => l.updatedAt],
      ['ID', (l) => l.id],
    ],
    rows,
  );
});

// ---------- Reports ----------
const reportListSchema = z.object({ status: z.enum([...REPORT_STATUSES, 'all']).optional().default('open') });

router.get('/reports', async (req, res) => {
  const { status } = validate(reportListSchema, req.query);
  const rows = await Report.findAll({
    where: status === 'all' ? {} : { status },
    include: [
      { model: User, as: 'reporter', attributes: ['id', 'name', 'avatarUrl', 'email'] },
      { model: User, as: 'targetUser', attributes: ['id', 'name', 'avatarUrl', 'email', 'suspendedAt', 'role'] },
      { model: User, as: 'reviewer', attributes: ['id', 'name'] },
    ],
    order: [['createdAt', status === 'open' ? 'ASC' : 'DESC']],
    limit: 200,
  });
  const reviewIds = rows.filter((r) => r.targetType === 'review').map((r) => r.targetId);
  const reviews = reviewIds.length
    ? new Map(
        (await Review.findAll({ where: { id: { [Op.in]: reviewIds } }, include: [{ model: User, as: 'reviewee', attributes: ['id', 'name'] }] })).map(
          (rv) => [rv.id, { ...rv.toPublic(), reviewee: rv.reviewee }],
        ),
      )
    : new Map();
  const listingIds = rows.filter((r) => r.targetType === 'listing').map((r) => r.targetId);
  const listings = listingIds.length
    ? new Map((await Listing.findAll({ where: { id: { [Op.in]: listingIds } }, attributes: ['id', 'title', 'status'] })).map((l) => [l.id, l]))
    : new Map();
  // How many open reports each member has, so repeat offenders stand out.
  const counts = new Map(
    (
      await Report.findAll({
        attributes: ['targetUserId', [fn('COUNT', col('id')), 'count']],
        where: { status: 'open', targetUserId: { [Op.ne]: null } },
        group: ['targetUserId'],
        raw: true,
      })
    ).map((r) => [r.targetUserId, Number(r.count)]),
  );
  res.json({
    items: rows.map((r) => ({
      ...r.toPublic(),
      reporter: r.reporter,
      targetUser: r.targetUser,
      reviewer: r.reviewer,
      listing: r.targetType === 'listing' ? listings.get(r.targetId) ?? null : null,
      review: r.targetType === 'review' ? reviews.get(r.targetId) ?? null : null,
      openAgainstUser: r.targetUserId ? counts.get(r.targetUserId) || 0 : 0,
    })),
  });
});

router.patch('/reports/:id', async (req, res) => {
  const report = await Report.findByPk(validate(idSchema, req.params.id));
  if (!report) throw notFound('Report not found');
  const { status, note } = validate(
    z.object({ status: z.enum(['resolved', 'dismissed', 'open']), note: z.string().trim().max(300).optional().default('') }),
    req.body,
  );
  const reviewed = status !== 'open';
  await report.update({
    status,
    resolutionNote: note,
    reviewedById: reviewed ? req.user.id : null,
    reviewedAt: reviewed ? new Date() : null,
  });
  if (reviewed) {
    await Notification.update({ readAt: new Date() }, { where: { type: 'report_new', entityId: report.id, readAt: null } });
  }
  const target = report.targetUserId ? await User.findByPk(report.targetUserId, { attributes: ['name'] }) : null;
  await logAdmin(req.user, `report.${status === 'open' ? 'reopened' : status}`, {
    targetType: 'report',
    targetId: report.id,
    targetLabel: `${report.targetType} report (${report.reason})${target ? ` about ${target.name}` : ''}`,
    summary: `${status === 'open' ? 'Reopened' : status === 'resolved' ? 'Resolved' : 'Dismissed'} the report${note ? `: ${note}` : ''}`,
    data: { targetUserId: report.targetUserId },
  });
  res.json({ report: report.toPublic() });
});

// ---------- Reviews ----------
router.delete('/reviews/:id', async (req, res) => {
  const review = await Review.findByPk(validate(idSchema, req.params.id), {
    include: [
      { model: User, as: 'reviewer', attributes: ['id', 'name'] },
      { model: User, as: 'reviewee', attributes: ['id', 'name'] },
    ],
  });
  if (!review) throw notFound('Review not found');
  const { reason } = validate(z.object({ reason: z.string().trim().max(300).optional().default('') }), req.body || {});
  await Notification.destroy({ where: { type: 'review_new', entityId: review.id } });
  await review.destroy();
  // Reports about this review are settled by removing it.
  await Report.update(
    { status: 'resolved', resolutionNote: reason || 'Review removed', reviewedById: req.user.id, reviewedAt: new Date() },
    { where: { targetType: 'review', targetId: review.id, status: 'open' } },
  );
  await logAdmin(req.user, 'review.deleted', {
    targetType: 'user',
    targetId: review.revieweeId,
    targetLabel: review.reviewee?.name ?? '',
    summary: `Removed a ${review.rating}★ review by ${review.reviewer?.name ?? 'a member'}${reason ? `: ${reason}` : ''}`,
    data: { reviewId: review.id, reviewerId: review.reviewerId, comment: review.comment },
  });
  res.status(204).end();
});

// ---------- Activity log ----------
const activitySchema = z.object({
  targetType: z.enum([...AUDIT_TARGETS, 'all']).optional().default('all'),
  targetId: z.string().trim().max(64).optional(),
  adminId: z.uuid().optional(),
  action: z.string().trim().max(40).optional().default(''),
  q: z.string().trim().max(100).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

function activityWhere(f) {
  const where = {};
  if (f.targetId) where.targetId = f.targetId;
  if (f.targetType !== 'all') where.targetType = f.targetType;
  if (f.adminId) where.adminId = f.adminId;
  if (f.action) where.action = { [Op.startsWith]: f.action };
  if (f.q) {
    const like = likeOp();
    const term = likeTerm(f.q);
    where[Op.and] = [{ [Op.or]: [{ summary: { [like]: term } }, { targetLabel: { [like]: term } }, { adminName: { [like]: term } }] }];
  }
  return where;
}

router.get('/activity', async (req, res) => {
  const f = validate(activitySchema, req.query);
  const { rows, count } = await AdminAction.findAndCountAll({
    where: activityWhere(f),
    order: [['createdAt', 'DESC']],
    limit: f.limit,
    offset: (f.page - 1) * f.limit,
  });
  const admins = await User.findAll({ where: { role: 'admin' }, attributes: ['id', 'name'], order: [['name', 'ASC']] });
  res.json({
    items: rows.map((r) => r.toPublic()),
    total: count,
    page: f.page,
    pages: Math.max(1, Math.ceil(count / f.limit)),
    admins: admins.map((a) => ({ id: a.id, name: a.name })),
  });
});

router.get('/activity/export.csv', adminExportLimiter, async (req, res) => {
  const f = validate(activitySchema.omit({ page: true, limit: true }), req.query);
  const rows = await AdminAction.findAll({ where: activityWhere(f), order: [['createdAt', 'DESC']], limit: 20000 });
  sendCsv(
    res,
    'profilehub-admin-activity',
    [
      ['When', (r) => r.createdAt],
      ['Admin', (r) => r.adminName],
      ['Action', (r) => r.action],
      ['Type', (r) => r.targetType],
      ['Target', (r) => r.targetLabel],
      ['Summary', (r) => r.summary],
      ['Target ID', (r) => r.targetId],
      ['Details', (r) => (r.data ? JSON.stringify(r.data) : '')],
    ],
    rows,
  );
});

export default router;
