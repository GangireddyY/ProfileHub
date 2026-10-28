import { Router } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { User, Block, Connection } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { blockLimiter } from '../middleware/limits.js';
import { clearRequestNotifications } from '../services/notifications.js';
import { emitToUser } from '../socket/emitter.js';
import { validate, badRequest, notFound } from '../utils/http.js';

/**
 * Blocking someone stops all contact both ways: no messages, invitations or seeing each other in Discover
 * and search, and any connection between you is removed. Mounted at /api/blocks.
 */
const router = Router();
router.use(requireAuth);

const idSchema = z.uuid('Invalid member');

router.get('/', async (req, res) => {
  const rows = await Block.findAll({
    where: { blockerId: req.user.id },
    include: [{ model: User, as: 'blocked', attributes: ['id', 'name', 'avatarUrl', 'roleTitle'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json({
    items: rows
      .filter((r) => r.blocked)
      .map((r) => ({ id: r.blocked.id, name: r.blocked.name, avatarUrl: r.blocked.avatarUrl, roleTitle: r.blocked.roleTitle, blockedAt: r.createdAt })),
  });
});

router.post('/:userId', blockLimiter, async (req, res) => {
  const me = req.user;
  const otherId = validate(idSchema, req.params.userId);
  if (otherId === me.id) throw badRequest("You can't block yourself");
  const other = await User.findByPk(otherId, { attributes: ['id', 'role'] });
  if (!other) throw notFound('This member does not exist');
  if (other.role === 'admin') throw badRequest("Admins can't be blocked. Report a problem instead.");

  await Block.findOrCreate({ where: { blockerId: me.id, blockedId: otherId } });
  const pairs = await Connection.findAll({
    where: {
      [Op.or]: [
        { requesterId: me.id, addresseeId: otherId },
        { requesterId: otherId, addresseeId: me.id },
      ],
    },
  });
  for (const row of pairs) {
    await clearRequestNotifications(row.id);
    await row.destroy();
  }
  for (const id of [me.id, otherId]) emitToUser(id, 'network:changed', {});
  res.status(201).json({ blocked: true });
});

router.delete('/:userId', blockLimiter, async (req, res) => {
  const otherId = validate(idSchema, req.params.userId);
  await Block.destroy({ where: { blockerId: req.user.id, blockedId: otherId } });
  emitToUser(req.user.id, 'network:changed', {});
  res.json({ blocked: false });
});

export default router;
