import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export const env = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
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
  /** Accounts with these emails are given the admin role every time the server starts. */
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
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
