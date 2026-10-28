import { Op } from 'sequelize';
import { Profession, ProfessionRequest, User } from '../models/index.js';
import { PROFESSION_CATEGORIES } from '../constants/professions.js';
import { notify } from './notifications.js';
import { badRequest, HttpError } from '../utils/http.js';

export const MAX_PENDING_REQUESTS = 5;

/** The catalog is small and read on almost every request, so keep it in memory and drop it on writes. */
let cache = null;

export function allProfessions() {
  cache ||= Profession.findAll({ order: [['label', 'ASC']] })
    .then((rows) => rows.map((r) => r.toPublic()))
    .catch((err) => {
      cache = null;
      throw err;
    });
  return cache;
}

export function invalidateProfessions() {
  cache = null;
}

export async function activeProfessions() {
  return (await allProfessions()).filter((p) => p.active);
}

export async function assertProfession(key, field = 'profession') {
  const ok = (await activeProfessions()).some((p) => p.key === key);
  if (!ok) throw badRequest('Pick a profession from the list', { fields: { [field]: 'Pick a profession from the list' } });
}

export const normalizeLabel = (label) => String(label).trim().replace(/\s+/g, ' ');

export async function findByLabel(label) {
  const wanted = normalizeLabel(label).toLowerCase();
  return (await allProfessions()).find((p) => p.label.toLowerCase() === wanted) || null;
}

/** Active profession keys whose label matches a free-text search, e.g. "driver" -> truck_driver, taxi_driver... */
export async function professionKeysMatching(q) {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  return (await activeProfessions()).filter((p) => p.label.toLowerCase().includes(term)).map((p) => p.key);
}

export async function professionKeysInCategories(categories) {
  if (!categories.length) return [];
  return (await activeProfessions()).filter((p) => categories.includes(p.category)).map((p) => p.key);
}

export async function categoryOf(key) {
  return (await allProfessions()).find((p) => p.key === key)?.category ?? null;
}

async function uniqueKey(label) {
  const base =
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 28) || 'profession';
  const taken = new Set((await allProfessions()).map((p) => p.key));
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
  return key;
}

export async function createProfession({ label, category, icon, hue, createdById = null }) {
  const clean = normalizeLabel(label);
  if (await findByLabel(clean)) throw new HttpError(409, `"${clean}" is already in the list`, { fields: { label: 'Already in the list' } });
  const group = PROFESSION_CATEGORIES.find((c) => c.key === category);
  const row = await Profession.create({
    key: await uniqueKey(clean),
    label: clean,
    category,
    icon: icon || group?.icon || 'Briefcase',
    hue: hue ?? group?.hue ?? 220,
    createdById,
  });
  invalidateProfessions();
  return row.toPublic();
}

export async function updateProfession(key, patch) {
  const row = await Profession.findByPk(key);
  if (!row) throw new HttpError(404, 'Profession not found');
  if (key === 'other' && patch.active === false) throw badRequest('"Other" is the fallback profession and must stay active');
  if (patch.label) {
    patch.label = normalizeLabel(patch.label);
    const clash = await findByLabel(patch.label);
    if (clash && clash.key !== key) throw new HttpError(409, `"${patch.label}" is already in the list`, { fields: { label: 'Already in the list' } });
  }
  await row.update(patch);
  invalidateProfessions();
  return row.toPublic();
}

export async function submitRequest(user, { label, category, note = '' }) {
  const clean = normalizeLabel(label);
  const existing = await findByLabel(clean);
  if (existing?.active) {
    throw new HttpError(409, `"${existing.label}" is already in the list, you can pick it right away`, {
      professionKey: existing.key,
      fields: { label: 'Already in the list' },
    });
  }

  const pending = await ProfessionRequest.findAll({ where: { userId: user.id, status: 'pending' } });
  if (pending.some((r) => r.label.toLowerCase() === clean.toLowerCase())) {
    throw new HttpError(409, 'You have already requested this profession', { fields: { label: 'Already requested' } });
  }
  if (pending.length >= MAX_PENDING_REQUESTS) {
    throw badRequest(`You can have up to ${MAX_PENDING_REQUESTS} requests waiting for review`);
  }

  const request = await ProfessionRequest.create({ userId: user.id, label: clean, category, note: note.trim() });
  const admins = await User.findAll({ where: { role: 'admin', id: { [Op.ne]: user.id } }, attributes: ['id'] });
  await Promise.all(
    admins.map((a) => notify({ userId: a.id, actorId: user.id, type: 'profession_request', entityId: request.id })),
  );
  return request;
}

/**
 * Adds the profession (or reuses/reactivates one with the same name) and resolves every pending
 * request for the same name in one go, so admins don't approve duplicates one by one.
 */
export async function approveRequest(admin, request, { label, category, icon, hue, assign = true }) {
  if (request.status !== 'pending') throw badRequest('This request has already been reviewed');

  const finalLabel = normalizeLabel(label || request.label);
  let profession = await findByLabel(finalLabel);
  if (profession && !profession.active) profession = await updateProfession(profession.key, { active: true });
  if (!profession) {
    profession = await createProfession({
      label: finalLabel,
      category: category || request.category,
      icon,
      hue,
      createdById: admin.id,
    });
  }

  const names = new Set([request.label.toLowerCase(), finalLabel.toLowerCase()]);
  const pending = await ProfessionRequest.findAll({ where: { status: 'pending' } });
  const resolved = pending.filter((r) => r.id === request.id || names.has(r.label.toLowerCase()));

  for (const r of resolved) {
    await r.update({ status: 'approved', professionKey: profession.key, reviewedById: admin.id, reviewedAt: new Date() });
    const requester = await User.findByPk(r.userId);
    if (!requester) continue;
    const shouldAssign = r.id === request.id ? assign : requester.profession === 'other';
    if (shouldAssign) await requester.update({ profession: profession.key });
    if (r.userId !== admin.id) {
      await notify({ userId: r.userId, actorId: admin.id, type: 'profession_approved', entityId: r.id });
    }
  }
  return { profession, resolved: resolved.length };
}

export async function rejectRequest(admin, request, note = '') {
  if (request.status !== 'pending') throw badRequest('This request has already been reviewed');
  await request.update({ status: 'rejected', reviewNote: note.trim(), reviewedById: admin.id, reviewedAt: new Date() });
  if (request.userId !== admin.id) {
    await notify({ userId: request.userId, actorId: admin.id, type: 'profession_rejected', entityId: request.id });
  }
  return request;
}
