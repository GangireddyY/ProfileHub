import { Router } from 'express';
import { z } from 'zod';
import { User, Listing, Report, Review } from '../models/index.js';
import { REPORT_TARGETS, REPORT_REASONS } from '../models/Report.js';
import { requireAuth } from '../middleware/auth.js';
import { reportLimiter } from '../middleware/limits.js';
import { notify } from '../services/notifications.js';
import { validate, badRequest, notFound } from '../utils/http.js';

/** Members report profiles, listings and conversations for the admins to review. Mounted at /api/reports. */
const router = Router();
router.use(requireAuth);

const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  /** User id for "user" and "conversation" (the other person), listing id for "listing", review id for "review". */
  targetId: z.uuid('Invalid report target'),
  reason: z.enum(REPORT_REASONS, { error: 'Pick a reason' }),
  details: z.string().trim().max(1000, 'Keep the details under 1000 characters').optional().default(''),
});

async function targetUserOf(type, id) {
  if (type === 'listing') {
    const listing = await Listing.findByPk(id, { attributes: ['id', 'sellerId'] });
    if (!listing) throw notFound('That listing no longer exists');
    return listing.sellerId;
  }
  if (type === 'review') {
    const review = await Review.findByPk(id, { attributes: ['id', 'reviewerId'] });
    if (!review) throw notFound('That review no longer exists');
    return review.reviewerId;
  }
  const user = await User.findByPk(id, { attributes: ['id'] });
  if (!user) throw notFound('That member no longer exists');
  return user.id;
}

router.post('/', reportLimiter, async (req, res) => {
  const data = validate(reportSchema, req.body);
  const targetUserId = await targetUserOf(data.targetType, data.targetId);
  if (targetUserId === req.user.id) throw badRequest("You can't report yourself");

  // Re-reporting the same thing updates the open report instead of piling up duplicates.
  const existing = await Report.findOne({
    where: { reporterId: req.user.id, targetType: data.targetType, targetId: data.targetId, status: 'open' },
  });
  if (existing) {
    await existing.update({ reason: data.reason, details: data.details || existing.details });
    return res.json({ report: existing.toPublic(), updated: true });
  }

  const report = await Report.create({ ...data, reporterId: req.user.id, targetUserId });
  const admins = await User.findAll({ where: { role: 'admin', suspendedAt: null }, attributes: ['id'] });
  await Promise.all(
    admins.map((a) =>
      notify({ userId: a.id, actorId: req.user.id, type: 'report_new', entityId: report.id, data: { targetType: data.targetType, reason: data.reason } }),
    ),
  );
  res.status(201).json({ report: report.toPublic() });
});

export default router;
