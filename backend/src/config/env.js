import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const isProd = process.env.NODE_ENV === 'production';

const days = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const env = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  /** Sessions end after this many days without activity, and after SESSION_MAX_DAYS no matter what. */
  sessionIdleDays: days(process.env.SESSION_IDLE_DAYS, 14),
  sessionMaxDays: days(process.env.SESSION_MAX_DAYS, 60),
  /** Send session cookies over HTTPS only. On by default in production. */
  secureCookies: process.env.SECURE_COOKIES ? process.env.SECURE_COOKIES === 'true' : isProd,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL || '',
  /** Postgres connection used when DB_NAME is set and DATABASE_URL is not. */
  db: {
    name: process.env.DB_NAME || '',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    logging: process.env.DB_LOGGING === 'true',
  },
  dbStorage: process.env.DB_STORAGE || './data/profilehub.sqlite',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  /**
   * Main admin account. Created on startup if it doesn't exist; the password is only used for that first
   * creation, so the admin can change it (and the rest of the profile) from Settings afterwards.
   */
  adminAccount: {
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
    name: (process.env.ADMIN_NAME || 'Administrator').trim(),
  },
};

/** Public address of the web app, used for links in emails and push notifications. */
env.appUrl = (process.env.APP_URL || env.clientOrigins[0] || 'http://localhost:5173').replace(/\/+$/, '');

/** Without an API key, emails are printed to the console instead of being sent (handy in development). */
env.mail = {
  sendgridKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: process.env.SENDGRID_FROM_EMAIL || '',
  fromName: process.env.SENDGRID_FROM_NAME || 'ProfileHUB',
};

/** Web Push keys (generate with `npx web-push generate-vapid-keys`). Push is off when they're missing. */
env.push = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
  subject: process.env.VAPID_SUBJECT || `mailto:${process.env.SENDGRID_FROM_EMAIL || 'admin@example.com'}`,
};
