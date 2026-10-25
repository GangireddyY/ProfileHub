import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ProfessionRequest } from '../models/index.js';
import { PROFESSION_CATEGORIES, CATEGORY_KEYS } from '../constants/professions.js';
import { requireAuth } from '../middleware/auth.js';
import { activeProfessions, submitRequest } from '../services/professions.js';
import { validate } from '../utils/http.js';

const router = Router();

export const professionRequestSchema = z.object({
  label: z
    .string({ error: 'Enter the profession name' })
    .trim()
    .min(2, 'Enter at least 2 characters')
    .max(60, 'Keep it under 60 characters')
    .regex(/^[\p{L}\p{N}][\p{L}\p{N} &/().,'+-]*$/u, 'Use letters, numbers and simple punctuation only'),
  category: z.enum(CATEGORY_KEYS, { error: 'Pick the closest category' }),
  note: z.string().trim().max(300, 'Keep the note under 300 characters').optional().default(''),
});

const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
});

/** Public: the signup screen needs the catalog before there is a session. */
router.get('/', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ categories: PROFESSION_CATEGORIES, professions: await activeProfessions() });
});

router.get('/requests/mine', requireAuth, async (req, res) => {
  const rows = await ProfessionRequest.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit: 20,
  });
  res.json({ items: rows.map((r) => r.toPublic()) });
});

router.post('/requests', requireAuth, requestLimiter, async (req, res) => {
  const data = validate(professionRequestSchema, req.body);
  const request = await submitRequest(req.user, data);
  res.status(201).json({ request: request.toPublic() });
});

export default router;
