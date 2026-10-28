import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/index.js';
import { requireAuth, SUSPENDED_MESSAGE } from '../middleware/auth.js';
import { buildSelf } from '../services/social.js';
import { assertProfession, submitRequest } from '../services/professions.js';
import { defaultPlan, planFields } from '../services/plans.js';
import { professionRequestSchema } from './professions.js';
import { RATE_UNITS, CURRENCIES } from '../constants/professions.js';
import { signToken } from '../utils/token.js';
import { validate, conflict, HttpError } from '../utils/http.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in a few minutes' },
});

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

router.post('/signup', authLimiter, async (req, res) => {
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
  });

  let professionRequest = null;
  if (data.requestedProfession) {
    try {
      professionRequest = (await submitRequest(user, data.requestedProfession)).toPublic();
    } catch {
      // The account matters more than the request; it can be re-sent from settings.
    }
  }

  res.status(201).json({ token: signToken(user.id), user: await buildSelf(user), professionRequest });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);
  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) throw new HttpError(401, 'Incorrect email or password');
  if (user.suspendedAt) throw new HttpError(403, SUSPENDED_MESSAGE);

  res.json({ token: signToken(user.id), user: await buildSelf(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await buildSelf(req.user) });
});

export default router;
