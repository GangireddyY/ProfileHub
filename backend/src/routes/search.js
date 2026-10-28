import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import { z } from 'zod';
import { User, Listing } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { decorateUsers } from '../services/social.js';
import { activeProfessions } from '../services/professions.js';
import { userSearchClause, listingSearchClause } from '../services/search.js';
import { haversineKm } from '../utils/geo.js';
import { validate } from '../utils/http.js';

/** One search box for people, professions and marketplace items. */
const router = Router();
router.use(requireAuth);

const schema = z.object({
  q: z.string().trim().min(1, 'Type something to search').max(100),
  limit: z.coerce.number().int().min(1).max(24).optional().default(8),
});

router.get('/', async (req, res) => {
  const me = req.user;
  const { q, limit } = validate(schema, req.query);
  const term = q.toLowerCase();

  const professionMatches = (await activeProfessions())
    .filter((p) => p.label.toLowerCase().includes(term))
    .sort((a, b) => a.label.toLowerCase().indexOf(term) - b.label.toLowerCase().indexOf(term))
    .slice(0, 12);

  const peopleWhere = {
    id: { [Op.ne]: me.id },
    discoverable: true,
    suspendedAt: null,
    [Op.and]: [await userSearchClause(q)],
  };
  const listingWhere = { status: 'active', [Op.and]: [listingSearchClause(q)] };

  const [people, peopleTotal, listings, listingTotal, counts] = await Promise.all([
    User.findAll({ where: peopleWhere, order: [['isOnline', 'DESC'], ['createdAt', 'DESC']], limit }),
    User.count({ where: peopleWhere }),
    Listing.findAll({ where: listingWhere, order: [['createdAt', 'DESC']], limit, include: [{ model: User, as: 'seller' }] }),
    Listing.count({ where: listingWhere }),
    professionMatches.length
      ? User.findAll({
          attributes: ['profession', [fn('COUNT', col('id')), 'count']],
          where: { discoverable: true, suspendedAt: null, profession: { [Op.in]: professionMatches.map((p) => p.key) } },
          group: ['profession'],
          raw: true,
        })
      : [],
  ]);
  const countMap = new Map(counts.map((r) => [r.profession, Number(r.count)]));

  res.json({
    q,
    professions: professionMatches.map((p) => ({ ...p, userCount: countMap.get(p.key) || 0 })),
    people: { items: await decorateUsers(me, people), total: peopleTotal },
    listings: {
      items: listings.map((l) => ({
        ...l.toPublic(),
        distanceKm:
          me.hasLocation && l.latitude != null
            ? Math.round(haversineKm(me.latitude, me.longitude, l.latitude, l.longitude) * 10) / 10
            : null,
        seller: l.seller ? { id: l.seller.id, name: l.seller.name, avatarUrl: l.seller.avatarUrl } : null,
      })),
      total: listingTotal,
    },
  });
});

export default router;
