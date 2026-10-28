import { User } from '../models/index.js';
import { verifyToken, isTokenStale } from '../utils/token.js';

export const SUSPENDED_MESSAGE = 'Your account has been suspended. Contact the ProfileHUB team for help.';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    const payload = verifyToken(token);
    const user = await User.findByPk(payload.sub, { attributes: { include: ['passwordChangedAt'] } });
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });
    if (isTokenStale(user, payload)) return res.status(401).json({ message: 'Password changed, please sign in again' });
    if (user.suspendedAt) return res.status(401).json({ message: SUSPENDED_MESSAGE, code: 'suspended' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please sign in again' });
  }
}

/** Use after requireAuth. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Only admins can do this' });
  next();
}
