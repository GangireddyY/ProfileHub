import { Router } from 'express';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User, Experience, Session } from '../models/index.js';
import { EXPERIENCE_KINDS } from '../models/Experience.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter, exportLimiter, emailLinkLimiter } from '../middleware/limits.js';
import { sendVerificationEmail, sendPasswordChangedEmail } from '../services/accountEmails.js';
import { buildSelf } from '../services/social.js';
import { listExperiences } from '../services/experiences.js';
import { deleteAccount, exportAccountData } from '../services/accounts.js';
import { revokeSession, revokeUserSessions } from '../services/sessions.js';
import { saveAvatar, removeAvatarFile, MAX_AVATAR_BYTES, AVATAR_MIME_TYPES } from '../services/avatars.js';
import { validate, badRequest, notFound, HttpError } from '../utils/http.js';

/** Routes for the signed-in member's own account, mounted at /api/users/me. */
const router = Router();

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in a few minutes' },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (AVATAR_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Upload a JPG, PNG, WebP, GIF or AVIF image'));
  },
});

async function loadWithPassword(userId) {
  return User.unscoped().findByPk(userId);
}

async function assertPassword(user, password) {
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(400, 'Incorrect password', { fields: { password: 'Incorrect password' } });
  }
}

// ---------- Avatar ----------
router.post('/avatar', requireAuth, uploadLimiter, upload.single('avatar'), async (req, res) => {
  if (!req.file) throw badRequest('Choose an image to upload');
  const previous = req.user.avatarUrl;
  const avatarUrl = await saveAvatar(req.user.id, req.file.buffer);
  await req.user.update({ avatarUrl });
  await removeAvatarFile(previous);
  res.json({ user: await buildSelf(req.user) });
});

router.delete('/avatar', requireAuth, async (req, res) => {
  await removeAvatarFile(req.user.avatarUrl);
  await req.user.update({ avatarUrl: '' });
  res.json({ user: await buildSelf(req.user) });
});

// ---------- Password ----------
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters').max(100, 'Password is too long'),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one',
  });

router.patch('/password', sensitiveLimiter, requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = validate(passwordSchema, req.body);
  const user = await loadWithPassword(req.user.id);
  try {
    await assertPassword(user, currentPassword);
  } catch (err) {
    err.details = { fields: { currentPassword: 'Incorrect password' } };
    throw err;
  }

  await user.update({ passwordHash: await bcrypt.hash(newPassword, 10), passwordChangedAt: new Date() });
  // Stay signed in here; every other device and tab is signed out.
  const signedOut = await revokeUserSessions(user.id, { except: req.session.id });
  sendPasswordChangedEmail(user);
  res.json({ user: await buildSelf(user), signedOut });
});

// ---------- Email verification ----------
router.post('/verify-email', requireAuth, emailLinkLimiter, async (req, res) => {
  if (req.user.emailVerifiedAt) return res.json({ alreadyVerified: true });
  await sendVerificationEmail(req.user);
  res.json({ sent: true, message: `We sent a confirmation link to ${req.user.email}.` });
});

// ---------- Sessions ("Where you're signed in") ----------
router.get('/sessions', requireAuth, async (req, res) => {
  const rows = await Session.findAll({
    where: { userId: req.user.id, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [['lastSeenAt', 'DESC']],
  });
  res.json({ items: rows.map((s) => s.toPublic(req.session.id)) });
});

router.delete('/sessions/:id', requireAuth, async (req, res) => {
  const id = validate(z.uuid('Invalid session'), req.params.id);
  const row = await Session.findOne({ where: { id, userId: req.user.id } });
  if (!row) throw notFound('That session has already ended');
  await revokeSession(row.id);
  res.status(204).end();
});

router.post('/sessions/revoke-others', requireAuth, async (req, res) => {
  res.json({ signedOut: await revokeUserSessions(req.user.id, { except: req.session.id }) });
});

// ---------- Download my data ----------
router.get('/export', requireAuth, exportLimiter, async (req, res) => {
  const data = await exportAccountData(req.user);
  res.setHeader('Content-Disposition', `attachment; filename="profilehub-data-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
});

// ---------- Delete account ----------
router.delete('/', sensitiveLimiter, requireAuth, async (req, res) => {
  const { password } = validate(z.object({ password: z.string().min(1, 'Enter your password') }), req.body);
  const user = await loadWithPassword(req.user.id);
  await assertPassword(user, password);
  await deleteAccount(user);
  res.status(204).end();
});

// ---------- Experience & education ----------
const MAX_EXPERIENCES = 30;
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM');
const currentMonth = () => new Date().toISOString().slice(0, 7);

const experienceSchema = z
  .object({
    kind: z.enum(EXPERIENCE_KINDS),
    title: z.string().trim().min(1, 'Title is required').max(100),
    organization: z.string().trim().min(1, 'This field is required').max(120),
    location: z.string().trim().max(100).optional().default(''),
    startDate: month,
    endDate: month.nullable().optional(),
    current: z.boolean().optional().default(false),
    description: z.string().trim().max(1000, 'Keep it under 1000 characters').optional().default(''),
  })
  .superRefine((v, ctx) => {
    if (v.startDate > currentMonth()) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Start date cannot be in the future' });
    }
    if (v.current) return;
    if (!v.endDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Add an end date or mark it as current' });
    } else if (v.endDate < v.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be after the start date' });
    }
  })
  .transform((v) => ({ ...v, endDate: v.current ? null : v.endDate }));

const idSchema = z.uuid('Invalid id');

async function findOwnExperience(userId, id) {
  const row = await Experience.findOne({ where: { id: validate(idSchema, id), userId } });
  if (!row) throw notFound('Entry not found');
  return row;
}

router.get('/experiences', requireAuth, async (req, res) => {
  res.json({ items: await listExperiences(req.user.id) });
});

router.post('/experiences', requireAuth, async (req, res) => {
  const data = validate(experienceSchema, req.body);
  if ((await Experience.count({ where: { userId: req.user.id } })) >= MAX_EXPERIENCES) {
    throw badRequest(`You can add up to ${MAX_EXPERIENCES} entries`);
  }
  await Experience.create({ ...data, userId: req.user.id });
  res.status(201).json({ items: await listExperiences(req.user.id) });
});

router.put('/experiences/:id', requireAuth, async (req, res) => {
  const row = await findOwnExperience(req.user.id, req.params.id);
  await row.update(validate(experienceSchema, req.body));
  res.json({ items: await listExperiences(req.user.id) });
});

router.delete('/experiences/:id', requireAuth, async (req, res) => {
  const row = await findOwnExperience(req.user.id, req.params.id);
  await row.destroy();
  res.json({ items: await listExperiences(req.user.id) });
});

export default router;
