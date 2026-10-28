import { Router } from 'express';
import { Op } from 'sequelize';
import multer from 'multer';
import { z } from 'zod';
import { Message, User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import {
  sendMessage,
  editMessage,
  deleteMessage,
  clearConversation,
  clearedAtMap,
  markConversationRead,
  conversationWhere,
  canMessage,
  messageableAmong,
  EDIT_WINDOW_MS,
} from '../services/messages.js';
import { MAX_CHAT_IMAGES, MAX_CHAT_IMAGE_BYTES, CHAT_IMAGE_MIME_TYPES } from '../services/chatImages.js';
import { validate, notFound, badRequest } from '../utils/http.js';
import { messageLimiter, chatPhotoLimiter } from '../middleware/limits.js';
import { blockState } from '../services/safety.js';
import { limitsFor, planLimit } from '../services/entitlements.js';

const router = Router();
router.use(requireAuth);

const idSchema = z.uuid('Invalid id');
const historySchema = z.object({
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CHAT_IMAGE_BYTES, files: MAX_CHAT_IMAGES },
  fileFilter: (req, file, cb) => {
    if (CHAT_IMAGE_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Send photos as JPG, PNG, WebP, GIF or AVIF'));
  },
});

/** Conversation list: everyone I've exchanged messages with, newest first. */
router.get('/conversations', async (req, res) => {
  const me = req.user.id;
  const [recent, cleared] = await Promise.all([
    Message.findAll({
      where: { [Op.or]: [{ senderId: me }, { receiverId: me }] },
      order: [['createdAt', 'DESC']],
      limit: 2000,
    }),
    clearedAtMap(me),
  ]);

  const byPartner = new Map();
  const wroteToMe = new Set();
  for (const m of recent.map((row) => row.get({ plain: true }))) {
    const partnerId = m.senderId === me ? m.receiverId : m.senderId;
    if (m.receiverId === me) wroteToMe.add(partnerId);
    // Messages from before I deleted the conversation are gone for me.
    const clearedAt = cleared.get(partnerId);
    if (clearedAt && new Date(m.createdAt) <= clearedAt) continue;
    if (!byPartner.has(partnerId)) byPartner.set(partnerId, { lastMessage: m, unread: 0 });
    if (m.receiverId === me && !m.readAt && !m.deletedAt) byPartner.get(partnerId).unread += 1;
  }

  const partnerIds = [...byPartner.keys()];
  const [users, allowed] = await Promise.all([
    User.findAll({ where: { id: { [Op.in]: partnerIds } } }),
    messageableAmong(me, partnerIds, wroteToMe),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = partnerIds
    .filter((id) => userMap.has(id))
    .map((id) => ({
      user: userMap.get(id).toPublic(),
      lastMessage: byPartner.get(id).lastMessage,
      unread: byPartner.get(id).unread,
      canMessage: allowed.has(id),
    }));

  res.json({ items });
});

// ---------- Single messages (edit / delete for everyone) ----------
router.patch('/item/:id', messageLimiter, async (req, res) => {
  const id = validate(idSchema, req.params.id);
  const message = await editMessage(req.user.id, id, req.body?.body);
  res.json({ message });
});

router.delete('/item/:id', async (req, res) => {
  const id = validate(idSchema, req.params.id);
  const message = await deleteMessage(req.user.id, id);
  res.json({ message });
});

router.get('/:userId', async (req, res) => {
  const me = req.user;
  const otherId = validate(idSchema, req.params.userId);
  const { before, limit } = validate(historySchema, req.query);

  const other = await User.findByPk(otherId);
  if (!other) throw notFound('This member does not exist');

  const where = conversationWhere(me.id, otherId);
  const clearedAt = (await clearedAtMap(me.id, [otherId])).get(otherId);
  const createdAt = {};
  if (before) createdAt[Op.lt] = new Date(before);
  if (clearedAt) createdAt[Op.gt] = clearedAt;
  if (before || clearedAt) where.createdAt = createdAt;

  const rows = await Message.findAll({ where, order: [['createdAt', 'DESC']], limit: limit + 1 });
  const hasMore = rows.length > limit;
  const messages = rows
    .slice(0, limit)
    .reverse()
    .map((row) => row.get({ plain: true }));
  const [allowed, blocks] = await Promise.all([canMessage(me.id, otherId), blockState(me.id, otherId)]);
  res.json({
    user: other.toPublic(),
    messages,
    hasMore,
    canMessage: allowed,
    blockedByMe: blocks.blockedByMe,
    unavailable: !other.isActiveMember || blocks.blockedMe,
    editWindowMs: EDIT_WINDOW_MS,
  });
});

router.post('/:userId', messageLimiter, async (req, res) => {
  const otherId = validate(idSchema, req.params.userId);
  const message = await sendMessage(req.user.id, otherId, req.body?.body);
  res.status(201).json({ message });
});

/** Photo message: up to 4 images plus an optional caption in `body`. */
router.post('/:userId/photos', chatPhotoLimiter, messageLimiter, upload.array('photos', MAX_CHAT_IMAGES), async (req, res) => {
  const otherId = validate(idSchema, req.params.userId);
  if (!req.files?.length) throw badRequest('Choose at least one photo');
  const { maxChatPhotos, messaging } = await limitsFor(req.user);
  if (!messaging) throw planLimit("Messaging isn't included in your plan. Upgrade your plan to chat with members.");
  if (!maxChatPhotos) throw planLimit('Sending photos in chat is not included in your plan. Upgrade to share photos.');
  if (req.files.length > maxChatPhotos) {
    throw planLimit(`Your plan lets you send up to ${maxChatPhotos} photo${maxChatPhotos === 1 ? '' : 's'} per message. Upgrade to send more.`);
  }
  const message = await sendMessage(req.user.id, otherId, req.body?.body, { files: req.files });
  res.status(201).json({ message });
});

router.post('/:userId/read', async (req, res) => {
  const otherId = validate(idSchema, req.params.userId);
  const result = await markConversationRead(req.user.id, otherId);
  res.json(result);
});

/** "Delete conversation": hides it for me only. */
router.delete('/:userId', async (req, res) => {
  const otherId = validate(idSchema, req.params.userId);
  if (otherId === req.user.id) throw badRequest('Invalid conversation');
  res.json(await clearConversation(req.user.id, otherId));
});

export default router;
