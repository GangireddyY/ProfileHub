import { Experience } from '../models/index.js';

export async function listExperiences(userId) {
  const rows = await Experience.findAll({
    where: { userId },
    order: [
      ['current', 'DESC'],
      ['startDate', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });
  return rows.map((r) => r.get({ plain: true }));
}
