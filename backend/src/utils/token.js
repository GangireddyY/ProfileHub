import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signToken = (userId) =>
  jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

/** Tokens issued before the last password change are no longer valid (compared at JWT's 1s precision). */
export function isTokenStale(user, payload) {
  if (!user.passwordChangedAt) return false;
  return payload.iat < Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
}
