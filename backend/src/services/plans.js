import { Op } from 'sequelize';
import { Plan, planExpiry } from '../models/Plan.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { FREE_LIMITS } from '../constants/planFeatures.js';
import { emitToUser } from '../socket/emitter.js';
import { deliverNotification } from './delivery.js';

/** Created when an install has no default plan yet. */
export const DEFAULT_PLAN = {
  name: 'Free',
  description: 'Everything you need to get discovered nearby.',
  price: 0,
  currency: 'INR',
  interval: 'lifetime',
  features: [],
  limits: { ...FREE_LIMITS },
  sortOrder: 0,
  active: true,
};

export const defaultPlan = () => Plan.findOne({ where: { isDefault: true } });

/** Plan id and expiry for a member who is (re)assigned `plan` now. */
export const planFields = (plan) => ({ planId: plan.id, planExpiresAt: planExpiry(plan.interval) });

/**
 * Makes sure exactly one default plan exists (reusing a plan called "Free" when there is one),
 * then puts every member without a plan, or with an expired one, on it.
 */
export async function ensureDefaultPlan() {
  let plan = await defaultPlan();
  if (!plan) {
    plan = (await Plan.findOne({ where: { name: { [Op.in]: ['Free', 'free', 'FREE'] } } })) || (await Plan.create(DEFAULT_PLAN));
    await plan.update({ isDefault: true, active: true });
  }
  await User.update({ planId: plan.id, planExpiresAt: null }, { where: { planId: null } });
  await downgradeExpiredPlans(plan);
  return plan;
}

/** In-app notice without an actor (system message), pushed live when the member is online. */
async function systemNotice(userId, type, data) {
  const notification = await Notification.create({ userId, actorId: null, type, data });
  emitToUser(userId, 'notification:new', { notification: { ...notification.get({ plain: true }), actor: null } });
  await deliverNotification(notification, null);
}

/** Members whose paid plan ran out go back to the default plan, and are told so. Returns how many were moved. */
export async function downgradeExpiredPlans(plan = null) {
  const fallback = plan || (await defaultPlan());
  if (!fallback) return 0;
  const expired = await User.findAll({
    where: { planExpiresAt: { [Op.lt]: new Date() }, planId: { [Op.ne]: fallback.id } },
    include: [{ model: Plan, as: 'plan', attributes: ['name'] }],
  });
  for (const user of expired) {
    const previous = user.plan?.name || 'paid';
    await user.update({ planId: fallback.id, planExpiresAt: null, planReminderAt: null });
    await systemNotice(user.id, 'plan_expired', { planName: previous, fallbackName: fallback.name });
  }
  return expired.length;
}

const REMIND_BEFORE_MS = 3 * 24 * 60 * 60 * 1000;

/** One heads-up per plan period, a few days before a paid plan ends. */
export async function remindExpiringPlans() {
  const soon = await User.findAll({
    where: { planExpiresAt: { [Op.between]: [new Date(), new Date(Date.now() + REMIND_BEFORE_MS)] }, planReminderAt: null },
    include: [{ model: Plan, as: 'plan', attributes: ['name'] }],
  });
  for (const user of soon) {
    await user.update({ planReminderAt: new Date() });
    await systemNotice(user.id, 'plan_expiring', { planName: user.plan?.name || 'paid', endsAt: user.planExpiresAt });
  }
  return soon.length;
}
