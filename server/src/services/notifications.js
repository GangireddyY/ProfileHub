import { Op } from 'sequelize';
import { Notification, User } from '../models/index.js';
import { emitToUser } from '../socket/emitter.js';

export async function notify({ userId, actorId, type, entityId = null }) {
  const notification = await Notification.create({ userId, actorId, type, entityId });
  const actor = await User.findByPk(actorId);
  emitToUser(userId, 'notification:new', {
    notification: { ...notification.get({ plain: true }), actor: actor?.toPublic() ?? null },
  });
  return notification;
}

/** Drop notifications that refer to a connection request which no longer exists or was re-sent. */
export function clearRequestNotifications(connectionId) {
  return Notification.destroy({ where: { type: 'connection_request', entityId: connectionId } });
}

export function markRequestHandled(userId, connectionId) {
  return Notification.update(
    { readAt: new Date() },
    { where: { userId, type: 'connection_request', entityId: connectionId, readAt: { [Op.is]: null } } },
  );
}

export function unreadNotificationCount(userId) {
  return Notification.count({ where: { userId, readAt: { [Op.is]: null } } });
}
