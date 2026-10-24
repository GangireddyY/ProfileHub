import { Router } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { Message, User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getConnectionIds, getStatus } from '../services/social.js';
import { sendMessage, markConversationRead, conversationWhere } from '../services/messages.js';
import { validate, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const idSchema = z.uuid('Invalid id');
const historySchema = z.object({
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

/** Conversation list: everyone I've exchanged messages with, newest first. */
router.get('/conversations', async (req, res) => {
  const me = req.user.id;
  const recent = await Message.findAll({
    where: { [Op.or]: [{ senderId: me }, { receiverId: me }] },
    order: [['createdAt', 'DESC']],
    limit: 2000,
  });

  const byPartner = new Map();
  for (const m of recent.map((row) => row.get({ plain: true }))) {
    const partnerId = m.senderId === me ? m.receiverId : m.senderId;
    if (!byPartner.has(partnerId)) byPartner.set(partnerId, { lastMessage: m, unread: 0 });
    if (m.receiverId === me && !m.readAt) byPartner.get(partnerId).unread += 1;
  }

  const partnerIds = [...byPartner.keys()];
  const [users, connected] = await Promise.all([
    User.findAll({ where: { id: { [Op.in]: partnerIds } } }),
    getConnectionIds(me),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = partnerIds
    .filter((id) => userMap.has(id))
    .map((id) => ({
      user: userMap.get(id).toPublic(),
      lastMessage: byPartner.get(id).lastMessage,
      unread: byPartner.get(id).unread,
      canMessage: connected.has(id),
    }));

  res.json({ items });
});

router.get('/:userId', async (req, res) => {
  const me = req.user;
  const otherId = validate(idSchema, req.params.userId);
  const { before, limit } = validate(historySchema, req.query);

  const other = await User.findByPk(otherId);
  if (!other) throw notFound('This member does not exist');

  const where = conversationWhere(me.id, otherId);
  if (before) where.createdAt = { [Op.lt]: new Date(before) };

  const rows = await Message.findAll({ where, order: [['createdAt', 'DESC']], limit: limit + 1 });
  const hasMore = rows.length > limit;
  const messages = rows
    .slice(0, limit)
    .reverse()
    .map((row) => row.get({ plain: true }));
  const { status } = await getStatus(me.id, otherId);

  res.json({ user: other.toPublic(), messages, hasMore, canMessage: status === 'connected' });
});

router.post('/:userId', async (req, res) => {
  const otherId = validate(idSchema, req.params.userId);
  const message = await sendMessage(req.user.id, otherId, req.body?.body);
  res.status(201).json({ message });
});

router.post('/:userId/read', async (req, res) => {
  const otherId = validate(idSchema, req.params.userId);
  const result = await markConversationRead(req.user.id, otherId);
  res.json(result);
});

export default router;
