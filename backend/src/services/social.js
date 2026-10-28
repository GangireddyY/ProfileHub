import { Op } from 'sequelize';
import { Connection, Message, Notification, Plan } from '../models/index.js';
import { downgradeExpiredPlans } from './plans.js';
import { limitsByPlan, limitsFrom, limitsFor } from './entitlements.js';
import { distanceBetween } from '../utils/geo.js';
import { ratingSummaries, ratingSummary } from './reviews.js';
import { normalizePrefs } from '../constants/notifyPrefs.js';

/** Relationship of `viewerId` towards another member, from the viewer's point of view. */
export const STATUS = {
  NONE: 'none',
  OUTGOING: 'outgoing',
  INCOMING: 'incoming',
  CONNECTED: 'connected',
};

export function findPair(a, b) {
  return Connection.findOne({
    where: {
      [Op.or]: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
}

export async function areConnected(a, b) {
  const row = await findPair(a, b);
  return row?.status === 'accepted';
}

export async function getConnectionIds(userId) {
  const rows = await Connection.findAll({
    attributes: ['requesterId', 'addresseeId'],
    where: { status: 'accepted', [Op.or]: [{ requesterId: userId }, { addresseeId: userId }] },
    raw: true,
  });
  return new Set(rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId)));
}

export async function getConnectionCounts(ids) {
  const counts = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return counts;
  const rows = await Connection.findAll({
    attributes: ['requesterId', 'addresseeId'],
    where: {
      status: 'accepted',
      [Op.or]: [{ requesterId: { [Op.in]: ids } }, { addresseeId: { [Op.in]: ids } }],
    },
    raw: true,
  });
  for (const r of rows) {
    if (counts.has(r.requesterId)) counts.set(r.requesterId, counts.get(r.requesterId) + 1);
    if (counts.has(r.addresseeId)) counts.set(r.addresseeId, counts.get(r.addresseeId) + 1);
  }
  return counts;
}

/**
 * A declined request still looks "pending" to the person who sent it (no rejection signal),
 * while the person who declined can start a fresh request themselves.
 */
function statusFromRow(row, viewerId) {
  if (!row) return STATUS.NONE;
  if (row.status === 'accepted') return STATUS.CONNECTED;
  const viewerSent = row.requesterId === viewerId;
  if (row.status === 'pending') return viewerSent ? STATUS.OUTGOING : STATUS.INCOMING;
  return viewerSent ? STATUS.OUTGOING : STATUS.NONE;
}

export async function getStatusMap(viewerId, ids) {
  const map = new Map(ids.map((id) => [id, { status: STATUS.NONE, connectionId: null }]));
  if (!ids.length) return map;
  const rows = await Connection.findAll({
    where: {
      [Op.or]: [
        { requesterId: viewerId, addresseeId: { [Op.in]: ids } },
        { addresseeId: viewerId, requesterId: { [Op.in]: ids } },
      ],
    },
    raw: true,
  });
  for (const row of rows) {
    const other = row.requesterId === viewerId ? row.addresseeId : row.requesterId;
    map.set(other, { status: statusFromRow(row, viewerId), connectionId: row.id });
  }
  return map;
}

export async function getStatus(viewerId, otherId) {
  const map = await getStatusMap(viewerId, [otherId]);
  return map.get(otherId);
}

/** Decorate a list of users with relationship info relative to the viewer. */
export async function decorateUsers(viewer, users) {
  const ids = users.map((u) => u.id);
  const [counts, statuses, planLimits, ratings] = await Promise.all([
    getConnectionCounts(ids),
    getStatusMap(viewer.id, ids),
    limitsByPlan(),
    ratingSummaries(ids),
  ]);
  return users.map((u) => ({
    ...u.toPublic(),
    verified: limitsFrom(planLimits, u).verifiedBadge,
    rating: ratings.get(u.id),
    distanceKm: distanceBetween(viewer, u),
    connectionCount: counts.get(u.id) || 0,
    connectionStatus: statuses.get(u.id)?.status || STATUS.NONE,
    connectionId: statuses.get(u.id)?.connectionId || null,
  }));
}

export async function buildSelf(user) {
  if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) {
    await downgradeExpiredPlans();
    await user.reload();
  }
  const [counts, pendingRequests, unreadMessages, unreadNotifications, plan, rating] = await Promise.all([
    getConnectionCounts([user.id]),
    Connection.count({ where: { addresseeId: user.id, status: 'pending' } }),
    Message.count({ where: { receiverId: user.id, readAt: null, deletedAt: null } }),
    Notification.count({ where: { userId: user.id, readAt: null } }),
    user.planId ? Plan.findByPk(user.planId) : null,
    ratingSummary(user.id),
  ]);
  return {
    ...user.toSelf(),
    notifyPrefs: normalizePrefs(user.notifyPrefs),
    rating,
    plan: plan?.toPublic() ?? null,
    /** What this member's plan unlocks right now (admins are never limited). */
    limits: await limitsFor(user),
    connectionCount: counts.get(user.id) || 0,
    pendingRequests,
    unreadMessages,
    unreadNotifications,
  };
}
