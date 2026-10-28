import { Router } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { Review, User, Notification } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { reviewLimiter } from '../middleware/limits.js';
import { notify } from '../services/notifications.js';
import { ratingSummary, reviewEligibility } from '../services/reviews.js';
import { blockedIdsFor, ACTIVE_MEMBER } from '../services/safety.js';
import { validate, notFound, HttpError } from '../utils/http.js';

/** Member-to-member ratings, mounted at /api/reviews. */
const router = Router();
router.use(requireAuth);

const idSchema = z.uuid('Invalid member');
const listSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
const reviewSchema = z.object({
  rating: z.coerce.number().int('Pick 1 to 5 stars').min(1, 'Pick 1 to 5 stars').max(5, 'Pick 1 to 5 stars'),
  comment: z.string().trim().max(1000, 'Keep the review under 1000 characters').optional().default(''),
});

const view = (review) => ({
  ...review.toPublic(),
  reviewer: review.reviewer ? { id: review.reviewer.id, name: review.reviewer.name, avatarUrl: review.reviewer.avatarUrl } : null,
});

router.get('/user/:userId', async (req, res) => {
  const revieweeId = validate(idSchema, req.params.userId);
  const { page, limit } = validate(listSchema, req.query);
  const target = await User.findByPk(revieweeId);
  if (!target || (!target.isActiveMember && !req.user.isAdmin)) throw notFound('This member does not exist');

  // Reviews from members who are hidden from me (blocked, suspended) don't show.
  const hidden = req.user.isAdmin ? [] : [...(await blockedIdsFor(req.user.id))];
  const where = { revieweeId, ...(hidden.length ? { reviewerId: { [Op.notIn]: hidden } } : {}) };
  const { rows, count } = await Review.findAndCountAll({
    where,
    include: [
      req.user.isAdmin
        ? { model: User, as: 'reviewer', required: false }
        : { model: User, as: 'reviewer', where: ACTIVE_MEMBER, required: true },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  const isMe = revieweeId === req.user.id;
  const [summary, mine, eligibility] = await Promise.all([
    ratingSummary(revieweeId),
    isMe ? null : Review.findOne({ where: { reviewerId: req.user.id, revieweeId } }),
    isMe ? { allowed: false } : reviewEligibility(req.user.id, revieweeId),
  ]);
  res.json({
    items: rows.map(view),
    total: count,
    page,
    pages: Math.max(1, Math.ceil(count / limit)),
    summary,
    mine: mine?.toPublic() ?? null,
    canReview: eligibility.allowed,
    reviewHint: eligibility.allowed ? null : eligibility.reason ?? null,
  });
});

router.put('/user/:userId', reviewLimiter, async (req, res) => {
  const revieweeId = validate(idSchema, req.params.userId);
  const data = validate(reviewSchema, req.body);
  const eligibility = await reviewEligibility(req.user.id, revieweeId);
  if (!eligibility.allowed) throw new HttpError(403, eligibility.reason, { code: 'not_eligible' });

  const existing = await Review.findOne({ where: { reviewerId: req.user.id, revieweeId } });
  let review;
  if (existing) {
    review = await existing.update(data);
  } else {
    review = await Review.create({ ...data, reviewerId: req.user.id, revieweeId });
    await notify({
      userId: revieweeId,
      actorId: req.user.id,
      type: 'review_new',
      entityId: review.id,
      data: { rating: review.rating, comment: review.comment.slice(0, 200) },
    });
  }
  res.status(existing ? 200 : 201).json({ review: review.toPublic(), summary: await ratingSummary(revieweeId) });
});

router.delete('/user/:userId', async (req, res) => {
  const revieweeId = validate(idSchema, req.params.userId);
  const review = await Review.findOne({ where: { reviewerId: req.user.id, revieweeId } });
  if (!review) throw notFound("You haven't reviewed this member");
  await Notification.destroy({ where: { type: 'review_new', entityId: review.id } });
  await review.destroy();
  res.json({ summary: await ratingSummary(revieweeId) });
});

export default router;
