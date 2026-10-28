import { Op, fn, col } from 'sequelize';
import { Review, Message, User } from '../models/index.js';
import { areConnected } from './social.js';
import { isBlockedBetween } from './safety.js';

/** { average, count } per member id; members without reviews get { average: null, count: 0 }. */
export async function ratingSummaries(ids) {
  const map = new Map(ids.map((id) => [id, { average: null, count: 0 }]));
  if (!ids.length) return map;
  const rows = await Review.findAll({
    attributes: ['revieweeId', [fn('AVG', col('rating')), 'average'], [fn('COUNT', col('id')), 'count']],
    where: { revieweeId: { [Op.in]: ids } },
    group: ['revieweeId'],
    raw: true,
  });
  for (const r of rows) map.set(r.revieweeId, { average: Math.round(Number(r.average) * 10) / 10, count: Number(r.count) });
  return map;
}

export async function ratingSummary(id) {
  return (await ratingSummaries([id])).get(id);
}

/**
 * Only people who actually dealt with each other may rate: connections, or two members who have both
 * written in the same conversation. That keeps strangers from leaving drive-by ratings.
 */
export async function reviewEligibility(reviewerId, revieweeId) {
  if (reviewerId === revieweeId) return { allowed: false, reason: "You can't review yourself." };
  const reviewee = await User.findByPk(revieweeId);
  if (!reviewee?.isActiveMember) return { allowed: false, reason: 'This member is not available.' };
  if (await isBlockedBetween(reviewerId, revieweeId)) return { allowed: false, reason: "You can't review this member." };
  if (await areConnected(reviewerId, revieweeId)) return { allowed: true };
  const [sent, received] = await Promise.all([
    Message.count({ where: { senderId: reviewerId, receiverId: revieweeId } }),
    Message.count({ where: { senderId: revieweeId, receiverId: reviewerId } }),
  ]);
  if (sent > 0 && received > 0) return { allowed: true };
  return { allowed: false, reason: 'You can review members you are connected with or have chatted with.' };
}
