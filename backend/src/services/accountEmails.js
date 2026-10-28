import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { AuthToken, User } from '../models/index.js';
import { sendEmail, appLink } from './mailer.js';

const HOUR = 60 * 60 * 1000;
export const TOKEN_TTL = { verify_email: 48 * HOUR, reset_password: 1 * HOUR };

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** New one-time link; any earlier unused link for the same purpose stops working. */
export async function issueToken(user, purpose) {
  await AuthToken.update({ usedAt: new Date() }, { where: { userId: user.id, purpose, usedAt: null } });
  const token = crypto.randomBytes(32).toString('base64url');
  await AuthToken.create({ userId: user.id, purpose, tokenHash: hash(token), expiresAt: new Date(Date.now() + TOKEN_TTL[purpose]) });
  return token;
}

/** Returns the account the link belongs to and marks the link used, or null if it's invalid/expired. */
export async function consumeToken(token, purpose) {
  if (!token || typeof token !== 'string' || token.length > 100) return null;
  const row = await AuthToken.findOne({
    where: { tokenHash: hash(token), purpose, usedAt: null, expiresAt: { [Op.gt]: new Date() } },
  });
  if (!row) return null;
  const user = await User.unscoped().findByPk(row.userId);
  if (!user) return null;
  await row.update({ usedAt: new Date() });
  return user;
}

export function purgeOldTokens() {
  return AuthToken.destroy({ where: { [Op.or]: [{ expiresAt: { [Op.lt]: new Date(Date.now() - 7 * 24 * HOUR) } }, { usedAt: { [Op.lt]: new Date(Date.now() - 7 * 24 * HOUR) } }] } });
}

const ACCOUNT_FOOTER = 'This is an account email from ProfileHUB. If you did not expect it, you can ignore it or reply to let us know.';

export async function sendVerificationEmail(user) {
  const token = await issueToken(user, 'verify_email');
  return sendEmail({
    to: user.email,
    subject: 'Confirm your email for ProfileHUB',
    heading: 'Confirm your email address',
    lines: [
      `Hi ${user.name},`,
      'Please confirm that this is your email address. It keeps your account safe and lets us send you updates, such as when an admin approves your account.',
      'The link works for 48 hours.',
    ],
    button: { label: 'Confirm email', url: appLink(`/verify-email?token=${token}`) },
    footer: ACCOUNT_FOOTER,
  });
}

export async function sendPasswordResetEmail(user) {
  const token = await issueToken(user, 'reset_password');
  return sendEmail({
    to: user.email,
    subject: 'Reset your ProfileHUB password',
    heading: 'Reset your password',
    lines: [
      `Hi ${user.name},`,
      'Someone asked to reset the password for your ProfileHUB account. If it was you, use the button below to choose a new password. The link works for 1 hour and can be used once.',
      "If you didn't ask for this, you can ignore this email: your password stays the same.",
    ],
    button: { label: 'Choose a new password', url: appLink(`/reset-password?token=${token}`) },
    footer: ACCOUNT_FOOTER,
  });
}

export function sendPasswordChangedEmail(user) {
  return sendEmail({
    to: user.email,
    subject: 'Your ProfileHUB password was changed',
    heading: 'Your password was changed',
    lines: [
      `Hi ${user.name},`,
      'The password for your ProfileHUB account was just changed, and other devices were signed out.',
      "If this wasn't you, reset your password right away and contact an admin.",
    ],
    button: { label: 'Reset password', url: appLink('/forgot-password') },
    footer: ACCOUNT_FOOTER,
  });
}

export function sendAccountDeclinedEmail(user, note = '') {
  return sendEmail({
    to: user.email,
    subject: 'About your ProfileHUB sign-up',
    heading: 'Your sign-up was not approved',
    lines: [`Hi ${user.name},`, 'An admin reviewed your sign-up and could not approve it.', note ? `Note from the admin: ${note}` : ''],
    footer: ACCOUNT_FOOTER,
  });
}

export function sendSuspendedEmail(user) {
  return sendEmail({
    to: user.email,
    subject: 'Your ProfileHUB account is suspended',
    heading: 'Your account has been suspended',
    lines: [
      `Hi ${user.name},`,
      'An admin suspended your account, usually after a report or a breach of the Terms & guidelines. You are signed out and your profile and listings are hidden.',
      'If you think this is a mistake, reply to this email.',
    ],
    button: { label: 'Read the guidelines', url: appLink('/terms') },
    footer: ACCOUNT_FOOTER,
  });
}

export function sendReactivatedEmail(user) {
  return sendEmail({
    to: user.email,
    subject: 'Your ProfileHUB account is active again',
    heading: 'Your account is active again',
    lines: [`Hi ${user.name},`, 'An admin lifted the suspension. You can sign in again.'],
    button: { label: 'Sign in', url: appLink('/login') },
    footer: ACCOUNT_FOOTER,
  });
}
