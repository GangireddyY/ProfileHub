import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Limits signed-in requests per member (so a shared office IP isn't punished) and anonymous ones per IP. */
function limiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => (req.user?.id ? `u:${req.user.id}` : `ip:${ipKeyGenerator(req.ip)}`),
    message: { message, code: 'rate_limited' },
  });
}

/** Catch-all for the whole API, per IP. Generous: only floods hit it. */
export const apiLimiter = rateLimit({
  windowMs: 5 * MINUTE,
  limit: 1500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down and try again shortly', code: 'rate_limited' },
});

export const signupLimiter = limiter(HOUR, 10, 'Too many sign-ups from this network. Try again in an hour.');
export const loginLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Per IP and email, so one person guessing passwords can't lock out a whole office.
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase().slice(0, 160)}`,
  message: { message: 'Too many sign-in attempts. Try again in a few minutes.', code: 'rate_limited' },
});

export const connectionRequestLimiter = limiter(HOUR, 40, "You're sending a lot of invitations. Try again in a while.");
export const messageLimiter = limiter(MINUTE, 30, "You're sending messages too quickly. Wait a moment and try again.");
export const planRequestLimiter = limiter(24 * HOUR, 5, "You've sent several plan requests today. Try again tomorrow.");
export const searchLimiter = limiter(MINUTE, 90, "You're searching too quickly. Wait a moment and try again.");
export const profileUpdateLimiter = limiter(10 * MINUTE, 60, "You're updating your profile too often. Try again in a few minutes.");
export const reportLimiter = limiter(HOUR, 15, "You've sent a lot of reports. Try again later, or email the team.");
export const blockLimiter = limiter(HOUR, 60, 'Too many block changes. Try again later.');
export const uploadLimiter = limiter(HOUR, 30, 'Too many uploads. Try again in an hour.');
export const exportLimiter = limiter(HOUR, 5, 'You can download your data a few times an hour. Try again later.');

/** Emails we send on request (reset links, verification): per IP and address, so nobody can mail-bomb an inbox. */
export const emailLinkLimiter = rateLimit({
  windowMs: HOUR,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || req.user?.email || '').toLowerCase().slice(0, 160)}`,
  message: { message: 'Too many emails requested. Check your inbox (and spam folder), or try again in an hour.', code: 'rate_limited' },
});
export const tokenLimiter = limiter(15 * MINUTE, 30, 'Too many attempts. Try again in a few minutes.');
export const chatPhotoLimiter = limiter(HOUR, 60, "You've sent a lot of photos. Try again in a while.");
export const reviewLimiter = limiter(HOUR, 20, "You've written a lot of reviews. Try again later.");
export const adminExportLimiter = limiter(HOUR, 30, 'Too many exports. Try again later.');
