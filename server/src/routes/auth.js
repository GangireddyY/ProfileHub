import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/index.js';
import { PROFESSIONS } from '../constants/professions.js';
import { requireAuth } from '../middleware/auth.js';
import { buildSelf } from '../services/social.js';
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
  profession: z.enum(PROFESSIONS, { error: 'Pick a profession' }),
  roleTitle: z.string().trim().max(100).optional().default(''),
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

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await User.create({
    name: data.name,
    email,
    passwordHash,
    profession: data.profession,
    roleTitle: data.roleTitle,
    headline: data.roleTitle,
  });

  res.status(201).json({ token: signToken(user.id), user: await buildSelf(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);
  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) throw new HttpError(401, 'Incorrect email or password');

  res.json({ token: signToken(user.id), user: await buildSelf(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await buildSelf(req.user) });
});

export default router;
