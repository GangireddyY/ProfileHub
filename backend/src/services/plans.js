import { Op } from 'sequelize';
import { Plan, planExpiry } from '../models/Plan.js';
import { User } from '../models/User.js';
import { FREE_LIMITS } from '../constants/planFeatures.js';

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

/** Members whose paid plan ran out go back to the default plan. Returns how many were moved. */
export async function downgradeExpiredPlans(plan = null) {
  const fallback = plan || (await defaultPlan());
  if (!fallback) return 0;
  const [count] = await User.update(
    { planId: fallback.id, planExpiresAt: null },
    { where: { planExpiresAt: { [Op.lt]: new Date() }, planId: { [Op.ne]: fallback.id } } },
  );
  return count;
}
