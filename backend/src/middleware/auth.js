import { env } from '../config/env.js';
import { resolveSession, tokenFrom, setSessionCookie } from '../services/sessions.js';

export const SUSPENDED_MESSAGE = 'Your account has been suspended. Contact the ProfileHUB team for help.';
export const PENDING_MESSAGE = "Your account is waiting for an admin to approve it. You'll be able to sign in once it's approved.";
export const REJECTED_MESSAGE = 'Your sign-up was not approved. Contact the ProfileHUB team if you think this is a mistake.';

/** Why an account may not use the app right now, or null when it can. */
export function accessProblem(user) {
  if (user.suspendedAt) return { message: SUSPENDED_MESSAGE, code: 'suspended' };
  if (user.approvalStatus === 'pending') return { message: PENDING_MESSAGE, code: 'pending_approval' };
  if (user.approvalStatus === 'rejected') {
    const note = user.approvalNote ? ` Reason: ${user.approvalNote}` : '';
    return { message: REJECTED_MESSAGE + note, code: 'rejected' };
  }
  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const slot = req.get('x-ph-slot');
    const token = tokenFrom(req.headers.cookie, slot);
    const found = await resolveSession(token);
    if (!found) return res.status(401).json({ message: 'Please sign in to continue', code: 'signed_out' });

    const problem = accessProblem(found.user);
    if (problem) return res.status(401).json(problem);

    req.user = found.user;
    req.session = found.session;
    // Sliding expiry: keep the cookie alive as long as the session is.
    if (found.refreshed) setSessionCookie(res, slot, token, found.session.expiresAt);
    next();
  } catch (err) {
    next(err);
  }
}

/** Use after requireAuth. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Only admins can do this' });
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for cookie sessions: anything that changes data must come from our own app. Browsers
 * won't let another site send the custom header without passing CORS, and we also check the Origin.
 */
export function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  let sameHost = false;
  try {
    sameHost = Boolean(origin) && new URL(origin).host === req.get('host');
  } catch {
    /* "null" or malformed origin: treated as foreign below */
  }
  if (origin && !sameHost && !env.clientOrigins.includes(origin)) {
    return res.status(403).json({ message: 'Request blocked: unknown origin' });
  }
  if (req.get('x-ph-client') !== 'web') {
    return res.status(403).json({ message: 'Request blocked: missing client header' });
  }
  next();
}
