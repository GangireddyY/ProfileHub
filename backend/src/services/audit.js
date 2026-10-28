import { AdminAction } from '../models/index.js';

/**
 * Records one admin action. `data` holds the details (e.g. changed fields as { field: [before, after] }).
 * Never throws: failing to log must not undo the action itself, but we do want to hear about it.
 */
export async function logAdmin(admin, action, { targetType, targetId = null, targetLabel = '', summary = '', data = null }) {
  try {
    await AdminAction.create({
      adminId: admin?.id ?? null,
      adminName: admin?.name ?? '',
      action,
      targetType,
      targetId: targetId ? String(targetId) : null,
      targetLabel: String(targetLabel || '').slice(0, 200),
      summary: String(summary || '').slice(0, 400),
      data,
    });
  } catch (err) {
    console.error(`Could not record admin action ${action}: ${err.message}`);
  }
}

const SKIP = new Set(['updatedAt', 'createdAt', 'passwordHash', 'isOnline', 'planReminderAt']);

/** { field: [before, after] } for the keys in `patch` whose value really changed. */
export function diff(before, patch) {
  const out = {};
  for (const [key, after] of Object.entries(patch)) {
    if (SKIP.has(key)) continue;
    const prev = before[key];
    const same = JSON.stringify(prev ?? null) === JSON.stringify(after ?? null);
    if (!same) out[key] = [prev ?? null, after ?? null];
  }
  return out;
}

const LABELS = {
  suspendedAt: 'suspension',
  approvalStatus: 'approval',
  approvalNote: 'approval note',
  planId: 'plan',
  planExpiresAt: 'plan end date',
  rateAmount: 'rate',
  contactEmail: 'contact email',
  roleTitle: 'role title',
  experienceYears: 'experience',
};

export const describeFields = (changes) =>
  Object.keys(changes)
    .map((k) => LABELS[k] || k.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`))
    .join(', ');
