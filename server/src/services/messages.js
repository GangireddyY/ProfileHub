import { Op } from 'sequelize';
import { Message, Listing } from '../models/index.js';
import { emitToUser } from '../socket/emitter.js';
import { forbidden, badRequest } from '../utils/http.js';
import { areConnected, getConnectionIds } from './social.js';

export const MAX_MESSAGE_LENGTH = 2000;

/** Members with at least one active marketplace listing, among `ids`. */
export async function sellersAmong(ids) {
  if (!ids.length) return new Set();
  const rows = await Listing.findAll({
    attributes: ['sellerId'],
    where: { status: 'active', sellerId: { [Op.in]: ids } },
    group: ['sellerId'],
    raw: true,
  });
  return new Set(rows.map((r) => r.sellerId));
}

/**
 * Connections can always talk. Anyone may also contact a member who is selling something,
 * and that seller may reply to people who wrote to them.
 */
export async function canMessage(senderId, receiverId) {
  if (await areConnected(senderId, receiverId)) return true;
  const sellers = await sellersAmong([senderId, receiverId]);
  if (sellers.has(receiverId)) return true;
  if (sellers.has(senderId)) {
    return (await Message.count({ where: { senderId: receiverId, receiverId: senderId } })) > 0;
  }
  return false;
}

/** Batch version of canMessage for the conversation list. `wroteToMe` = partners who have messaged `me`. */
export async function messageableAmong(me, partnerIds, wroteToMe) {
  const [connected, sellers] = await Promise.all([getConnectionIds(me), sellersAmong([me, ...partnerIds])]);
  const iSell = sellers.has(me);
  return new Set(partnerIds.filter((id) => connected.has(id) || sellers.has(id) || (iSell && wroteToMe.has(id))));
}

export async function sendMessage(senderId, receiverId, rawBody) {
  const body = String(rawBody ?? '').trim();
  if (!body) throw badRequest('Message cannot be empty');
  if (body.length > MAX_MESSAGE_LENGTH) throw badRequest(`Message is too long (max ${MAX_MESSAGE_LENGTH})`);
  if (senderId === receiverId) throw badRequest('You cannot message yourself');
  if (!(await canMessage(senderId, receiverId))) {
    throw forbidden('You can message people in your network or members who are selling something');
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
