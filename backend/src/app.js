import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import connectionRoutes from './routes/connections.js';
import messageRoutes from './routes/messages.js';
import accountRoutes from './routes/account.js';
import notificationRoutes from './routes/notifications.js';
import professionRoutes from './routes/professions.js';
import adminRoutes from './routes/admin.js';
import listingRoutes from './routes/listings.js';
import searchRoutes from './routes/search.js';
import { AVATAR_DIR } from './services/avatars.js';
import { LISTING_IMAGE_DIR } from './services/listingImages.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../frontend/dist');

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", 'ws:', 'wss:', 'https://nominatim.openstreetmap.org'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        },
      },
    }),
  );
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  if (!env.isProd) app.use(morgan('dev'));

  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users/me', accountRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/connections', connectionRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/professions', professionRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/listings', listingRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api', notFoundHandler);

  app.use(
    '/uploads/avatars',
    express.static(AVATAR_DIR, { maxAge: '30d', immutable: true, index: false, fallthrough: false }),
  );
  app.use(
    '/uploads/listings',
    express.static(LISTING_IMAGE_DIR, { maxAge: '30d', immutable: true, index: false, fallthrough: false }),
  );

  // Serve the built Vue app (npm run build) from the same origin in production.
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1h', index: false }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/socket.io')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
