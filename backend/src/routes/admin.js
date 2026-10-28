import { Router } from 'express';
import { fn, col } from 'sequelize';
import { z } from 'zod';
import { User, Listing, ProfessionRequest } from '../models/index.js';
import { CATEGORY_KEYS, PROFESSION_ICONS } from '../constants/professions.js';
import { REQUEST_STATUSES } from '../models/ProfessionRequest.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  allProfessions,
  createProfession,
  updateProfession,
  approveRequest,
  rejectRequest,
} from '../services/professions.js';
import { validate, notFound } from '../utils/http.js';

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
  const [users, admins, activeListings, pendingRequests, professions] = await Promise.all([
    User.count(),
    User.count({ where: { role: 'admin' } }),
    Listing.count({ where: { status: 'active' } }),
    ProfessionRequest.count({ where: { status: 'pending' } }),
    allProfessions(),
  ]);
  res.json({
    users,
    admins,
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

export default router;
