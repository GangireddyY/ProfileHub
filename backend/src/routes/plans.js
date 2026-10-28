import { Router } from 'express';
import { z } from 'zod';
import { User, Plan, PlanRequest, Notification } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { notify } from '../services/notifications.js';
import { validate, badRequest, notFound, conflict } from '../utils/http.js';

/** Plans members can see, and their upgrade requests ("tickets") to the admins. Mounted at /api/plans. */
const router = Router();
router.use(requireAuth);

const requestSchema = z.object({
  planId: z.uuid('Pick a plan'),
  message: z.string().trim().max(500, 'Keep the message under 500 characters').optional().default(''),
});

const myRequests = (userId) =>
  PlanRequest.findAll({
    where: { userId },
    include: [{ model: Plan, as: 'plan' }],
    order: [['createdAt', 'DESC']],
    limit: 10,
  });

router.get('/', async (req, res) => {
  const [plans, requests] = await Promise.all([
    Plan.findAll({ where: { active: true }, order: [['sortOrder', 'ASC'], ['price', 'ASC']] }),
    myRequests(req.user.id),
  ]);
  res.json({
    plans: plans.map((p) => p.toPublic()),
    currentPlanId: req.user.planId,
    planExpiresAt: req.user.planExpiresAt,
    requests: requests.map((r) => r.toPublic()),
  });
});

router.post('/requests', async (req, res) => {
  const { planId, message } = validate(requestSchema, req.body);
  const plan = await Plan.findOne({ where: { id: planId, active: true } });
  if (!plan) throw notFound('That plan is not available');
  if (plan.id === req.user.planId) throw badRequest(`You're already on the ${plan.name} plan`);
  if (await PlanRequest.count({ where: { userId: req.user.id, status: 'pending' } })) {
    throw conflict('You already have a request waiting for review. Cancel it first to ask for another plan.');
  }

  const request = await PlanRequest.create({ userId: req.user.id, planId: plan.id, message });
  const admins = await User.findAll({ where: { role: 'admin', suspendedAt: null }, attributes: ['id'] });
  await Promise.all(
    admins.map((a) => notify({ userId: a.id, actorId: req.user.id, type: 'plan_request', entityId: request.id })),
  );

  res.status(201).json({ request: { ...request.toPublic(), plan: plan.toPublic() } });
});

router.delete('/requests/:id', async (req, res) => {
  const id = validate(z.uuid('Invalid id'), req.params.id);
  const request = await PlanRequest.findOne({ where: { id, userId: req.user.id } });
  if (!request) throw notFound('Request not found');
  if (request.status !== 'pending') throw badRequest('Only pending requests can be cancelled');
  await Notification.destroy({ where: { type: 'plan_request', entityId: request.id } });
  await request.destroy();
  res.json({ requests: (await myRequests(req.user.id)).map((r) => r.toPublic()) });
});

export default router;
