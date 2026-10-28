import { Router } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { isPostgres } from '../config/db.js';
import { Connection, User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { emitToUser } from '../socket/emitter.js';
import { STATUS, decorateUsers, findPair } from '../services/social.js';
import { notify, clearRequestNotifications, markRequestHandled } from '../services/notifications.js';
import { validate, badRequest, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const idSchema = z.uuid('Invalid id');

function notifyNetworkChanged(...userIds) {
  for (const id of userIds) emitToUser(id, 'network:changed', {});
}

async function sendRequestEvent(row, requester) {
  await clearRequestNotifications(row.id);
  await notify({ userId: row.addresseeId, actorId: row.requesterId, type: 'connection_request', entityId: row.id });
  emitToUser(row.addresseeId, 'connection:request', {
    connectionId: row.id,
    user: requester.toPublic(),
  });
  notifyNetworkChanged(row.requesterId, row.addresseeId);
}

async function acceptRow(row) {
  await row.update({ status: 'accepted', respondedAt: new Date() });
  const addressee = await User.findByPk(row.addresseeId);
  await markRequestHandled(row.addresseeId, row.id);
  await notify({ userId: row.requesterId, actorId: row.addresseeId, type: 'connection_accepted', entityId: row.id });
  emitToUser(row.requesterId, 'connection:accepted', {
    connectionId: row.id,
    user: addressee.toPublic(),
  });
  notifyNetworkChanged(row.requesterId, row.addresseeId);
}

/** My accepted connections. */
router.get('/', async (req, res) => {
  const me = req.user;
  const q = String(req.query.q || '').trim().slice(0, 100);

  const rows = await Connection.findAll({
    where: { status: 'accepted', [Op.or]: [{ requesterId: me.id }, { addresseeId: me.id }] },
  });
  const connectedAt = new Map(
    rows.map((r) => [r.requesterId === me.id ? r.addresseeId : r.requesterId, r.respondedAt || r.updatedAt]),
  );

  const where = { id: { [Op.in]: [...connectedAt.keys()] } };
  if (q) {
    const like = isPostgres() ? Op.iLike : Op.like;
    const term = `%${q.replace(/[%_]/g, '')}%`;
    where[Op.or] = [{ name: { [like]: term } }, { roleTitle: { [like]: term } }, { city: { [like]: term } }];
  }
  const users = await User.findAll({ where, order: [['name', 'ASC']] });
  const items = (await decorateUsers(me, users)).map((u) => ({ ...u, connectedAt: connectedAt.get(u.id) }));

  res.json({ items, total: connectedAt.size });
});

/** Pending invitations, both directions. */
router.get('/requests', async (req, res) => {
  const me = req.user;
  const [incoming, outgoing] = await Promise.all([
    Connection.findAll({
      where: { addresseeId: me.id, status: 'pending' },
      include: [{ model: User, as: 'requester' }],
      order: [['createdAt', 'DESC']],
    }),
    Connection.findAll({
      where: { requesterId: me.id, status: { [Op.in]: ['pending', 'declined'] } },
      include: [{ model: User, as: 'addressee' }],
      order: [['createdAt', 'DESC']],
    }),
  ]);

  const [incomingUsers, outgoingUsers] = await Promise.all([
    decorateUsers(me, incoming.map((r) => r.requester)),
    decorateUsers(me, outgoing.map((r) => r.addressee)),
  ]);

  res.json({
    incoming: incoming.map((r, i) => ({ id: r.id, createdAt: r.createdAt, user: incomingUsers[i] })),
    outgoing: outgoing.map((r, i) => ({ id: r.id, createdAt: r.createdAt, user: outgoingUsers[i] })),
  });
});

/** Send a connection request (or accept theirs if they already asked). */
router.post('/:userId', async (req, res) => {
  const me = req.user;
  const targetId = validate(idSchema, req.params.userId);
  if (targetId === me.id) throw badRequest("You can't connect with yourself");

  const target = await User.findByPk(targetId);
  if (!target) throw notFound('This member does not exist');

  const row = await findPair(me.id, targetId);

  if (!row) {
    const created = await Connection.create({ requesterId: me.id, addresseeId: targetId });
    await sendRequestEvent(created, me);
    return res.status(201).json({ status: STATUS.OUTGOING, connectionId: created.id });
  }

  if (row.status === 'accepted') return res.json({ status: STATUS.CONNECTED, connectionId: row.id });

  const iSent = row.requesterId === me.id;
  if (iSent) return res.json({ status: STATUS.OUTGOING, connectionId: row.id });

  if (row.status === 'pending') {
    await acceptRow(row);
    return res.json({ status: STATUS.CONNECTED, connectionId: row.id });
  }

  // I previously declined them and now want to connect: flip the request around.
  await row.update({ requesterId: me.id, addresseeId: targetId, status: 'pending', respondedAt: null });
  await sendRequestEvent(row, me);
  res.json({ status: STATUS.OUTGOING, connectionId: row.id });
});

async function findIncomingRequest(id, me) {
  const row = await Connection.findByPk(validate(idSchema, id));
  if (!row || row.addresseeId !== me.id || row.status !== 'pending') {
    throw notFound('This invitation is no longer available');
  }
  return row;
}

router.post('/requests/:id/accept', async (req, res) => {
  const row = await findIncomingRequest(req.params.id, req.user);
  await acceptRow(row);
  const requester = await User.findByPk(row.requesterId);
  const [user] = await decorateUsers(req.user, [requester]);
  res.json({ status: STATUS.CONNECTED, user });
});

router.post('/requests/:id/decline', async (req, res) => {
  const row = await findIncomingRequest(req.params.id, req.user);
  await row.update({ status: 'declined', respondedAt: new Date() });
  await markRequestHandled(req.user.id, row.id);
  notifyNetworkChanged(req.user.id);
  res.json({ status: STATUS.NONE });
});

/** Withdraw my request, ignore theirs, or remove an existing connection. */
router.delete('/:userId', async (req, res) => {
  const me = req.user;
  const otherId = validate(idSchema, req.params.userId);
  const row = await findPair(me.id, otherId);
  if (!row) return res.json({ status: STATUS.NONE });

  if (row.status === 'pending' && row.addresseeId === me.id) {
    await row.update({ status: 'declined', respondedAt: new Date() });
    await markRequestHandled(me.id, row.id);
    notifyNetworkChanged(me.id);
  } else {
    const wasConnected = row.status === 'accepted';
    if (!wasConnected) await clearRequestNotifications(row.id);
    await row.destroy();
    if (wasConnected) emitToUser(otherId, 'connection:removed', { userId: me.id });
    notifyNetworkChanged(me.id, otherId);
  }
  res.json({ status: STATUS.NONE });
});

export default router;
