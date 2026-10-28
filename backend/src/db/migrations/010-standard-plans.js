import crypto from 'node:crypto';
import { FREE_LIMITS, PRO_LIMITS, BUSINESS_LIMITS } from '../../constants/planFeatures.js';

/**
 * Ready-made Free / Pro / Business plans. Runs once; admins can edit or delete them afterwards,
 * and existing plans with the same names are left alone.
 */
const PLANS = [
  {
    name: 'Free',
    description: 'Everything you need to get discovered nearby and start selling.',
    price: 0,
    interval: 'lifetime',
    sortOrder: 0,
    limits: FREE_LIMITS,
    features: ['Profile in Discover and search', 'Chat with connections and sellers', 'Ratings and reviews'],
  },
  {
    name: 'Pro',
    description: 'For professionals who want more work: message anyone, rank higher and get a verified badge.',
    price: 499,
    interval: 'month',
    sortOrder: 1,
    limits: PRO_LIMITS,
    features: ['Email alerts for messages and invitations', 'Priority support'],
  },
  {
    name: 'Business',
    description: 'For shops and agencies: unlimited listings, featured placement and public contact details.',
    price: 1499,
    interval: 'month',
    sortOrder: 2,
    limits: BUSINESS_LIMITS,
    features: ['Unlimited invitations', 'Dedicated support'],
  },
];

export async function up({ context: qi }) {
  const [existing] = await qi.sequelize.query('SELECT id, name, "isDefault" FROM plans');
  const byName = new Map(existing.map((p) => [String(p.name).toLowerCase(), p]));
  const now = new Date();
  const rows = [];

  for (const plan of PLANS) {
    const found = byName.get(plan.name.toLowerCase());
    if (found) {
      // Only the starter Free plan gets the new defaults; other existing plans keep what the admin set.
      if (plan.name === 'Free') {
        await qi.bulkUpdate(
          'plans',
          { description: plan.description, features: JSON.stringify(plan.features), limits: JSON.stringify(plan.limits), updatedAt: now },
          { id: found.id },
        );
      }
      continue;
    }
    rows.push({
      id: crypto.randomUUID(),
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: 'INR',
      interval: plan.interval,
      features: JSON.stringify(plan.features),
      limits: JSON.stringify(plan.limits),
      active: true,
      isDefault: plan.name === 'Free' && !existing.some((p) => p.isDefault),
      sortOrder: plan.sortOrder,
      createdAt: now,
      updatedAt: now,
    });
  }
  if (rows.length) await qi.bulkInsert('plans', rows);
}

export async function down({ context: qi }) {
  await qi.bulkDelete('plans', { name: ['Pro', 'Business'] });
}
