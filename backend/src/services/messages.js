import { Op } from 'sequelize';
import { Message, Listing, User, ChatClear } from '../models/index.js';
import { emitToUser } from '../socket/emitter.js';
import { badRequest, notFound, HttpError } from '../utils/http.js';
import { areConnected, getConnectionIds } from './social.js';
import { isBlockedBetween, blockedIdsFor, ACTIVE_MEMBER } from './safety.js';
import { limitsFor, planLimit } from './entitlements.js';
import { saveChatImage, removeChatImages } from './chatImages.js';
import { deliverMessage } from './delivery.js';

export const MAX_MESSAGE_LENGTH = 2000;
/** Messages can be corrected for a short while after sending; deleting is always possible. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

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
 * Needs a plan with "messaging". Then connections can talk, anyone may contact a member who is
 * selling something, and that seller may reply to people who wrote to them.
 */
export async function canMessage(senderId, receiverId) {
  const [sender, receiver] = await Promise.all([User.findByPk(senderId), User.findByPk(receiverId)]);
  if (!receiver || !receiver.isActiveMember) return false;
  const limits = await limitsFor(sender);
  if (!limits.messaging) return false;
  if (await isBlockedBetween(senderId, receiverId)) return false;
  if (await areConnected(senderId, receiverId)) return true;
  // Plans with "message anyone" may start a conversation with any active member.
  if (limits.messageAnyone) return true;
  const sellers = await sellersAmong([senderId, receiverId]);
  if (sellers.has(receiverId)) return true;
  // Anyone may reply to someone who wrote to them first.
  return (await Message.count({ where: { senderId: receiverId, receiverId: senderId } })) > 0;
}

/** Batch version of canMessage for the conversation list. `wroteToMe` = partners who have messaged `me`. */
export async function messageableAmong(me, partnerIds, wroteToMe) {
  const [user, blocked, active] = await Promise.all([
    User.findByPk(me),
    blockedIdsFor(me),
    User.findAll({ where: { id: { [Op.in]: partnerIds }, ...ACTIVE_MEMBER }, attributes: ['id'] }),
  ]);
  const limits = await limitsFor(user);
  if (!limits.messaging) return new Set();
  const reachable = new Set(active.map((u) => u.id));
  const candidates = partnerIds.filter((id) => reachable.has(id) && !blocked.has(id));
  if (limits.messageAnyone) return new Set(candidates);
  const [connected, sellers] = await Promise.all([getConnectionIds(me), sellersAmong(candidates)]);
  return new Set(candidates.filter((id) => connected.has(id) || sellers.has(id) || wroteToMe.has(id)));
}

/** Sliding-window send limit per member, shared by the REST endpoint and the realtime socket. */
const SEND_WINDOW_MS = 60 * 1000;
const SEND_LIMIT = 30;
const recentSends = new Map();
function assertSendRate(senderId) {
  const now = Date.now();
  const times = (recentSends.get(senderId) || []).filter((t) => now - t < SEND_WINDOW_MS);
  if (times.length >= SEND_LIMIT) {
    throw new HttpError(429, "You're sending messages too quickly. Wait a moment and try again.", { code: 'rate_limited' });
  }
  times.push(now);
  recentSends.set(senderId, times);
}
setInterval(() => {
  const now = Date.now();
  for (const [id, times] of recentSends) if (!times.some((t) => now - t < SEND_WINDOW_MS)) recentSends.delete(id);
}, 5 * 60 * 1000).unref();

const cleanBody = (raw) => String(raw ?? '').trim();

/** `files` are multer buffers for photo messages; they're only saved once every check has passed. */
export async function sendMessage(senderId, receiverId, rawBody, { files = [] } = {}) {
  const body = cleanBody(rawBody);
  if (!body && !files.length) throw badRequest('Message cannot be empty');
  if (body.length > MAX_MESSAGE_LENGTH) throw badRequest(`Message is too long (max ${MAX_MESSAGE_LENGTH})`);
  if (senderId === receiverId) throw badRequest('You cannot message yourself');
  assertSendRate(senderId);
  if (await isBlockedBetween(senderId, receiverId)) {
    throw new HttpError(403, "You can't message this member.", { code: 'blocked' });
  }
  if (!(await canMessage(senderId, receiverId))) {
    const sender = await User.findByPk(senderId);
    if (sender && !(await limitsFor(sender)).messaging) {
      throw planLimit("Messaging isn't included in your plan. Upgrade your plan to chat with members.");
    }
    throw planLimit(
      'You can message people in your network or members who are selling something. Upgrade your plan to message anyone.',
    );
  }

  const attachments = [];
  try {
    for (const file of files) attachments.push(await saveChatImage(file.buffer));
  } catch (err) {
    await removeChatImages(attachments);
    throw err;
  }

  const message = await Message.create({ senderId, receiverId, body, attachments: attachments.length ? attachments : null });
  const payload = message.get({ plain: true });
  emitToUser(receiverId, 'message:new', payload);
  // Keep the sender's other tabs/devices in sync.
  emitToUser(senderId, 'message:new', payload);
  User.findByPk(senderId).then((sender) => sender && deliverMessage(sender, payload));
  return payload;
}

async function findOwnMessage(userId, id) {
  const message = await Message.findByPk(id);
  if (!message || (message.senderId !== userId && message.receiverId !== userId)) throw notFound('Message not found');
  if (message.senderId !== userId) throw new HttpError(403, 'You can only change messages you sent');
  if (message.deletedAt) throw badRequest('This message was already deleted');
  return message;
}

function broadcastUpdate(message) {
  const payload = message.get({ plain: true });
  emitToUser(message.receiverId, 'message:updated', payload);
  emitToUser(message.senderId, 'message:updated', payload);
  return payload;
}

export async function editMessage(userId, id, rawBody) {
  const message = await findOwnMessage(userId, id);
  if (!(await limitsFor(await User.findByPk(userId))).messaging) {
    throw planLimit("Messaging isn't included in your plan. Upgrade your plan to chat with members.");
  }
  if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
    throw badRequest('Messages can only be edited for 15 minutes after sending');
  }
  const body = cleanBody(rawBody);
  if (!body && !message.attachments?.length) throw badRequest('Message cannot be empty');
  if (body.length > MAX_MESSAGE_LENGTH) throw badRequest(`Message is too long (max ${MAX_MESSAGE_LENGTH})`);
  if (body === message.body) return message.get({ plain: true });
  await message.update({ body, editedAt: new Date() });
  return broadcastUpdate(message);
}

/** Deletes for everyone: the text and photos are gone, a placeholder stays so replies still make sense. */
export async function deleteMessage(userId, id) {
  const message = await findOwnMessage(userId, id);
  const photos = message.attachments;
  await message.update({ body: '', attachments: null, deletedAt: new Date(), readAt: message.readAt || new Date() });
  await removeChatImages(photos);
  return broadcastUpdate(message);
}

/** When `userId` last deleted the conversation with each partner. */
export async function clearedAtMap(userId, otherIds = null) {
  const where = { userId };
  if (otherIds) where.otherId = { [Op.in]: otherIds };
  const rows = await ChatClear.findAll({ where, raw: true });
  return new Map(rows.map((r) => [r.otherId, new Date(r.clearedAt)]));
}

/** Hides the whole conversation for `userId` only; the other member still sees it. */
export async function clearConversation(userId, otherId) {
  const clearedAt = new Date();
  const existing = await ChatClear.findOne({ where: { userId, otherId } });
  if (existing) await existing.update({ clearedAt });
  else await ChatClear.create({ userId, otherId, clearedAt });
  await Message.update({ readAt: clearedAt }, { where: { senderId: otherId, receiverId: userId, readAt: null } });
  emitToUser(userId, 'conversation:cleared', { with: otherId, at: clearedAt });
  return { clearedAt };
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
