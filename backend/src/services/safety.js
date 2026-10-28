import { Op } from 'sequelize';
import { Block } from '../models/index.js';

/** Members others may see and contact: approved and not suspended. Spread into a User `where`. */
export const ACTIVE_MEMBER = Object.freeze({ approvalStatus: 'approved', suspendedAt: null });

/** Ids of everyone `userId` blocked or was blocked by; neither side sees or contacts the other. */
export async function blockedIdsFor(userId) {
  const rows = await Block.findAll({
    where: { [Op.or]: [{ blockerId: userId }, { blockedId: userId }] },
    attributes: ['blockerId', 'blockedId'],
    raw: true,
  });
  return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}

export async function isBlockedBetween(a, b) {
  return (
    (await Block.count({
      where: {
        [Op.or]: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    })) > 0
  );
}

/** { blockedByMe, blockedMe } between the viewer and another member. */
export async function blockState(viewerId, otherId) {
  const rows = await Block.findAll({
    where: {
      [Op.or]: [
        { blockerId: viewerId, blockedId: otherId },
        { blockerId: otherId, blockedId: viewerId },
      ],
    },
    raw: true,
  });
  return {
    blockedByMe: rows.some((r) => r.blockerId === viewerId),
    blockedMe: rows.some((r) => r.blockerId === otherId),
  };
}
