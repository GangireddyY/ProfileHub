import { Router } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { Notification, User, ProfessionRequest } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { decorateUsers } from '../services/social.js';
import { unreadNotificationCount } from '../services/notifications.js';
import { allProfessions } from '../services/professions.js';
import { validate, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const listSchema = z.object({
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

router.get('/', async (req, res) => {
  const me = req.user;
  const { before, limit } = validate(listSchema, req.query);

  const where = { userId: me.id };
  if (before) where.createdAt = { [Op.lt]: new Date(before) };

  const rows = await Notification.findAll({
    where,
    include: [{ model: User, as: 'actor' }],
    order: [['createdAt', 'DESC']],
    limit: limit + 1,
  });
  const page = rows.slice(0, limit).filter((n) => n.actor);
  const actors = await decorateUsers(
    me,
    page.map((n) => n.actor),
  );

  const requestIds = page.filter((n) => n.type.startsWith('profession_') && n.entityId).map((n) => n.entityId);
  const [requests, professions] = requestIds.length
    ? await Promise.all([ProfessionRequest.findAll({ where: { id: { [Op.in]: requestIds } } }), allProfessions()])
    : [[], []];
  const requestMap = new Map(requests.map((r) => [r.id, r]));
  const labels = new Map(professions.map((p) => [p.key, p.label]));
  const metaFor = (n) => {
    const r = requestMap.get(n.entityId);
    if (!r) return null;
    return {
      label: r.label,
      status: r.status,
      reviewNote: r.reviewNote,
      professionKey: r.professionKey,
      professionLabel: r.professionKey ? labels.get(r.professionKey) || r.label : null,
    };
  };

  res.json({
    items: page.map((n, i) => ({
      id: n.id,
      type: n.type,
      entityId: n.entityId,
      readAt: n.readAt,
      createdAt: n.createdAt,
      actor: actors[i],
      meta: metaFor(n),
    })),
    hasMore: rows.length > limit,
    unreadCount: await unreadNotificationCount(me.id),
  });
});

router.post('/read-all', async (req, res) => {
  await Notification.update({ readAt: new Date() }, { where: { userId: req.user.id, readAt: { [Op.is]: null } } });
  res.json({ unreadCount: 0 });
});

router.post('/:id/read', async (req, res) => {
  const id = validate(z.uuid('Invalid id'), req.params.id);
  const notification = await Notification.findOne({ where: { id, userId: req.user.id } });
  if (!notification) throw notFound('Notification not found');
  if (!notification.readAt) await notification.update({ readAt: new Date() });
  res.json({ unreadCount: await unreadNotificationCount(req.user.id) });
});

export default router;
