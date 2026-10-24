import { User } from '../models/index.js';
import { verifyToken } from '../utils/token.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    const { sub } = verifyToken(token);
    const user = await User.findByPk(sub);
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please sign in again' });
  }
}
