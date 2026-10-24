import { Op } from 'sequelize';
import { Message } from '../models/index.js';
import { emitToUser } from '../socket/emitter.js';
import { forbidden, badRequest } from '../utils/http.js';
import { areConnected } from './social.js';

export const MAX_MESSAGE_LENGTH = 2000;

export async function sendMessage(senderId, receiverId, rawBody) {
  const body = String(rawBody ?? '').trim();
  if (!body) throw badRequest('Message cannot be empty');
  if (body.length > MAX_MESSAGE_LENGTH) throw badRequest(`Message is too long (max ${MAX_MESSAGE_LENGTH})`);
  if (senderId === receiverId) throw badRequest('You cannot message yourself');
  if (!(await areConnected(senderId, receiverId))) {
    throw forbidden('You can only message people in your network');
  }

  const message = await Message.create({ senderId, receiverId, body });
  const payload = message.get({ plain: true });
  emitToUser(receiverId, 'message:new', payload);
  // Keep the sender's other tabs/devices in sync.
  emitToUser(senderId, 'message:new', payload);
  return payload;
}

export async function markConversationRead(readerId, otherId) {
  const readAt = new Date();
  const [count] = await Message.update(
    { readAt },
    { where: { senderId: otherId, receiverId: readerId, readAt: null } },
  );
  if (count > 0) {
    emitToUser(otherId, 'message:read', { by: readerId, at: readAt });
    emitToUser(readerId, 'message:read-self', { from: otherId, at: readAt });
  }
  return { count, readAt };
}

export function conversationWhere(a, b) {
  return {
    [Op.or]: [
      { senderId: a, receiverId: b },
      { senderId: b, receiverId: a },
    ],
  };
}
