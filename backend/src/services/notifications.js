import { Op } from 'sequelize';
import { Notification, User } from '../models/index.js';
import { emitToUser } from '../socket/emitter.js';
import { deliverNotification } from './delivery.js';

/** In-app notification, pushed live to open tabs, then sent by email/push in the background. */
export async function notify({ userId, actorId = null, type, entityId = null, data = null }) {
  const notification = await Notification.create({ userId, actorId, type, entityId, data });
  const actor = actorId ? await User.findByPk(actorId) : null;
  emitToUser(userId, 'notification:new', {
    notification: { ...notification.get({ plain: true }), actor: actor?.toPublic() ?? null },
  });
  deliverNotification(notification, actor);
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
