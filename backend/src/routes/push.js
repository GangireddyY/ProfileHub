import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { profileUpdateLimiter } from '../middleware/limits.js';
import { PushSubscription } from '../models/index.js';
import { pushEnabled, saveSubscription, removeSubscription, sendPush, endpointHash } from '../services/push.js';
import { validate, badRequest } from '../utils/http.js';

/** Browser/phone push notifications, mounted at /api/push. */
const router = Router();
router.use(requireAuth);

const subscriptionSchema = z.object({
  endpoint: z.url('Invalid push endpoint').max(2000).refine((u) => u.startsWith('https://'), 'Invalid push endpoint'),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

router.get('/config', async (req, res) => {
  const endpoint = typeof req.query.endpoint === 'string' ? req.query.endpoint : '';
  const subscribed = endpoint
    ? Boolean(await PushSubscription.count({ where: { userId: req.user.id, endpointHash: endpointHash(endpoint) } }))
    : false;
  res.json({
    enabled: pushEnabled(),
    publicKey: pushEnabled() ? env.push.publicKey : null,
    subscribed,
    devices: await PushSubscription.count({ where: { userId: req.user.id } }),
  });
});

router.post('/subscriptions', profileUpdateLimiter, async (req, res) => {
  if (!pushEnabled()) throw badRequest('Push notifications are not set up on this server');
  const sub = validate(subscriptionSchema, req.body);
  await saveSubscription(req.user.id, sub, req.get('user-agent') || '');
  res.status(201).json({ subscribed: true });
});

router.delete('/subscriptions', async (req, res) => {
  const { endpoint } = validate(z.object({ endpoint: z.string().min(1).max(2000) }), req.body || {});
  const removed = await removeSubscription(req.user.id, endpoint);
  res.json({ subscribed: false, removed });
});

router.post('/test', profileUpdateLimiter, async (req, res) => {
  const delivered = await sendPush(req.user.id, {
    title: 'ProfileHUB notifications are on',
    body: "You'll get alerts here for messages, invitations and account updates.",
    url: '/settings#notifications',
    tag: 'test',
  });
  res.json({ delivered });
});

export default router;
