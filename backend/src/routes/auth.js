import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/index.js';
import { requireAuth, accessProblem, PENDING_MESSAGE } from '../middleware/auth.js';
import { signupLimiter, loginLimiter, emailLinkLimiter, tokenLimiter } from '../middleware/limits.js';
import { consumeToken, sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail } from '../services/accountEmails.js';
import { buildSelf } from '../services/social.js';
import { assertProfession, submitRequest } from '../services/professions.js';
import { defaultPlan, planFields } from '../services/plans.js';
import { notify } from '../services/notifications.js';
import {
  createSession,
  resolveSession,
  revokeSession,
  revokeUserSessions,
  tokenFrom,
  setSessionCookie,
  clearSessionCookie,
} from '../services/sessions.js';
import { professionRequestSchema } from './professions.js';
import { RATE_UNITS, CURRENCIES } from '../constants/professions.js';
import { validate, conflict, HttpError } from '../utils/http.js';

const router = Router();

const emailField = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(160)
  .pipe(z.email('Enter a valid email address'));

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: emailField,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long'),
  /** Usually chosen on the welcome screen right after signup, so it starts as "other". */
  profession: z.string().trim().min(1).max(48).optional().default('other'),
  roleTitle: z.string().trim().max(100).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  availableForWork: z.boolean().optional().default(false),
  rateAmount: z.coerce.number().int('Use a whole number').min(1, 'Rate must be at least 1').max(10_000_000).nullable().optional(),
  rateUnit: z.enum(RATE_UNITS).optional().default('hour'),
  currency: z.enum(CURRENCIES).optional().default('INR'),
  /** Sent when the member's profession isn't in the list yet; they start as "Other" until an admin adds it. */
  requestedProfession: professionRequestSchema.optional(),
});

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

/** New accounts start "pending": they can't sign in until an admin approves them. */
router.post('/signup', signupLimiter, async (req, res) => {
  const data = validate(signupSchema, req.body);
  const email = data.email.toLowerCase();

  if (await User.count({ where: { email } })) {
    throw conflict('An account with this email already exists');
  }
  await assertProfession(data.profession);

  const passwordHash = await bcrypt.hash(data.password, 10);
  const starter = await defaultPlan();
  const user = await User.create({
    ...(starter ? planFields(starter) : {}),
    name: data.name,
    email,
    passwordHash,
    profession: data.profession,
    roleTitle: data.roleTitle,
    headline: data.roleTitle,
    city: data.city,
    availableForWork: data.availableForWork,
    rateAmount: data.rateAmount ?? null,
    rateUnit: data.rateUnit,
    currency: data.currency,
    role: 'member',
    approvalStatus: 'pending',
  });

  if (data.requestedProfession) {
    try {
      await submitRequest(user, data.requestedProfession);
    } catch {
      // The account matters more than the request; it can be re-sent from settings.
    }
  }

  const admins = await User.findAll({ where: { role: 'admin', suspendedAt: null }, attributes: ['id'] });
  await Promise.all(admins.map((a) => notify({ userId: a.id, actorId: user.id, type: 'signup_request', entityId: user.id })));
  sendVerificationEmail(user);

  res.status(201).json({ pending: true, message: PENDING_MESSAGE, verificationSent: true });
});

// ---------- Email verification & password reset ----------
const tokenSchema = z.object({ token: z.string().trim().min(20, 'This link is not valid').max(100, 'This link is not valid') });
const INVALID_LINK = 'This link is invalid or has expired. Ask for a new one.';
/** Same answer whether or not the address has an account, so the form can't be used to look people up. */
const GENERIC_SENT = "If there's an account for that email, we've sent a link to it. Check your inbox and spam folder.";

router.post('/verify-email', tokenLimiter, async (req, res) => {
  const { token } = validate(tokenSchema, req.body);
  const user = await consumeToken(token, 'verify_email');
  if (!user) throw new HttpError(400, INVALID_LINK, { code: 'invalid_token' });
  if (!user.emailVerifiedAt) await user.update({ emailVerifiedAt: new Date() });
  res.json({ verified: true, email: user.email, approved: user.approvalStatus === 'approved' });
});

router.post('/resend-verification', emailLinkLimiter, async (req, res) => {
  const { email } = validate(z.object({ email: emailField }), req.body);
  const user = await User.findOne({ where: { email } });
  if (user && !user.emailVerifiedAt && !user.suspendedAt) await sendVerificationEmail(user);
  res.json({ message: GENERIC_SENT });
});

router.post('/forgot-password', emailLinkLimiter, async (req, res) => {
  const { email } = validate(z.object({ email: emailField }), req.body);
  const user = await User.findOne({ where: { email } });
  if (user && user.approvalStatus !== 'rejected') await sendPasswordResetEmail(user);
  res.json({ message: GENERIC_SENT });
});

router.post('/reset-password', tokenLimiter, async (req, res) => {
  const { token, password } = validate(
    tokenSchema.extend({ password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password is too long') }),
    req.body,
  );
  const user = await consumeToken(token, 'reset_password');
  if (!user) throw new HttpError(400, INVALID_LINK, { code: 'invalid_token' });
  await user.update({
    passwordHash: await bcrypt.hash(password, 10),
    passwordChangedAt: new Date(),
    // Opening the emailed link proves the address belongs to them.
    emailVerifiedAt: user.emailVerifiedAt || new Date(),
  });
  const signedOut = await revokeUserSessions(user.id);
  sendPasswordChangedEmail(user);
  const problem = accessProblem(user);
  res.json({ reset: true, signedOut, canSignIn: !problem, message: problem?.message ?? null });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);
  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) throw new HttpError(401, 'Incorrect email or password');
  const problem = accessProblem(user);
  if (problem) throw new HttpError(403, problem.message, { code: problem.code });

  const { token, session } = await createSession(user, req);
  setSessionCookie(res, req.get('x-ph-slot'), token, session.expiresAt);
  res.json({ user: await buildSelf(user) });
});

/** Ends this tab's session on the server, not just in the browser. */
router.post('/logout', async (req, res) => {
  const slot = req.get('x-ph-slot');
  const found = await resolveSession(tokenFrom(req.headers.cookie, slot));
  if (found) await revokeSession(found.session.id);
  clearSessionCookie(res, slot);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await buildSelf(req.user) });
});

export default router;
