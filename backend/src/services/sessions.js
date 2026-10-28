import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { Session, User } from '../models/index.js';
import { disconnectSession } from '../socket/emitter.js';

const DAY = 24 * 60 * 60 * 1000;
/** Don't write "last seen" on every request; once every few minutes is plenty. */
const TOUCH_EVERY = 5 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 20;

/**
 * Each browser tab picks a "slot" and sends it in the X-PH-Slot header, so one browser can be signed in as
 * different accounts in different tabs. The token itself only ever lives in the httpOnly cookie for that slot.
 */
const SLOT = /^[a-z0-9]{6,24}$/;
export const slotOf = (value) => (typeof value === 'string' && SLOT.test(value) ? value : 'main');
const cookieName = (slot) => `ph_s_${slot}`;

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const key = part.slice(0, i).trim();
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* ignore malformed cookie */
    }
  }
  return out;
}

/** The raw session token for this request's slot, if any. */
export function tokenFrom(cookieHeader, slot) {
  return parseCookies(cookieHeader)[cookieName(slotOf(slot))] || null;
}

const cookieOptions = (expires) => ({
  httpOnly: true,
  secure: env.secureCookies,
  sameSite: 'lax',
  path: '/',
  expires,
});

export function setSessionCookie(res, slot, token, expires) {
  res.cookie(cookieName(slotOf(slot)), token, cookieOptions(expires));
}

export function clearSessionCookie(res, slot) {
  res.clearCookie(cookieName(slotOf(slot)), { ...cookieOptions(undefined), expires: undefined });
}

const idleExpiry = (from = Date.now()) => new Date(from + env.sessionIdleDays * DAY);

/** Starts a session for `user` and returns the raw token for the cookie. */
export async function createSession(user, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const session = await Session.create({
    userId: user.id,
    tokenHash: hash(token),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ip: String(req.ip || '').slice(0, 64),
    lastSeenAt: now,
    expiresAt: idleExpiry(now.getTime()),
  });
  await pruneSessions(user.id);
  return { token, session };
}

/**
 * Looks up a live session for a raw token. Sessions slide forward while in use, up to SESSION_MAX_DAYS
 * after sign-in. Returns { session, user, refreshed } or null.
 */
export async function resolveSession(token) {
  if (!token || token.length > 200) return null;
  const session = await Session.findOne({
    where: { tokenHash: hash(token), revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    include: [{ model: User, as: 'user', attributes: { include: ['passwordChangedAt'] } }],
  });
  if (!session?.user) return null;

  const hardLimit = new Date(session.createdAt).getTime() + env.sessionMaxDays * DAY;
  if (Date.now() > hardLimit) {
    await session.update({ revokedAt: new Date() });
    return null;
  }

  let refreshed = false;
  if (Date.now() - new Date(session.lastSeenAt).getTime() > TOUCH_EVERY) {
    await session.update({ lastSeenAt: new Date(), expiresAt: new Date(Math.min(idleExpiry().getTime(), hardLimit)) });
    refreshed = true;
  }
  return { session, user: session.user, refreshed };
}

export async function revokeSession(sessionId) {
  await Session.update({ revokedAt: new Date() }, { where: { id: sessionId, revokedAt: null } });
  disconnectSession(sessionId);
}

/** Signs a member out everywhere (optionally keeping one session, e.g. the one that changed the password). */
export async function revokeUserSessions(userId, { except = null } = {}) {
  const where = { userId, revokedAt: null, ...(except ? { id: { [Op.ne]: except } } : {}) };
  const ids = (await Session.findAll({ where, attributes: ['id'] })).map((s) => s.id);
  if (!ids.length) return 0;
  await Session.update({ revokedAt: new Date() }, { where: { id: { [Op.in]: ids } } });
  ids.forEach(disconnectSession);
  return ids.length;
}

/** Drop dead sessions and keep at most MAX_SESSIONS_PER_USER live ones per member. */
async function pruneSessions(userId) {
  await Session.destroy({
    where: { userId, [Op.or]: [{ revokedAt: { [Op.ne]: null } }, { expiresAt: { [Op.lt]: new Date() } }] },
  });
  const live = await Session.findAll({ where: { userId }, order: [['lastSeenAt', 'DESC']], attributes: ['id'] });
  const extra = live.slice(MAX_SESSIONS_PER_USER).map((s) => s.id);
  if (extra.length) await Session.destroy({ where: { id: { [Op.in]: extra } } });
}

/** Periodic cleanup of sessions nobody can use any more. */
export function purgeDeadSessions() {
  return Session.destroy({
    where: { [Op.or]: [{ revokedAt: { [Op.lt]: new Date(Date.now() - DAY) } }, { expiresAt: { [Op.lt]: new Date() } }] },
  });
}
