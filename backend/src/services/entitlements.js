import { Plan } from '../models/Plan.js';
import { ADMIN_LIMITS, normalizeLimits } from '../constants/planFeatures.js';
import { HttpError } from '../utils/http.js';

/** planId -> limits for every plan, plus `default` for members without a plan. Plans are few, so load them all. */
export async function limitsByPlan() {
  const plans = await Plan.findAll({ attributes: ['id', 'limits', 'isDefault'] });
  const map = new Map(plans.map((p) => [p.id, normalizeLimits(p.limits)]));
  const fallback = plans.find((p) => p.isDefault);
  map.set('default', fallback ? map.get(fallback.id) : normalizeLimits(null));
  return map;
}

export function limitsFrom(map, user) {
  if (user?.role === 'admin') return ADMIN_LIMITS;
  return map.get(user?.planId) || map.get('default');
}

export async function limitsFor(user) {
  return limitsFrom(await limitsByPlan(), user);
}

/** 403 with a hint to upgrade, so the app can point members to the Plans page. */
export const planLimit = (message) => new HttpError(403, message, { code: 'plan_limit' });
