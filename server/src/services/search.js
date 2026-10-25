import { Op } from 'sequelize';
import { sequelize, isPostgres } from '../config/db.js';
import { LISTING_CATEGORY_KEYWORDS } from '../constants/marketplace.js';
import { professionKeysMatching } from './professions.js';

export const likeOp = () => (isPostgres() ? Op.iLike : Op.like);
export const likeTerm = (q) => `%${q.replace(/[%_]/g, '')}%`;

/** Free-text match on people, including profession names ("driver" finds every kind of driver). */
export async function userSearchClause(q) {
  const like = likeOp();
  const term = likeTerm(q);
  const castType = sequelize.getDialect() === 'mysql' ? 'CHAR' : 'TEXT';
  const professionKeys = await professionKeysMatching(q);
  return {
    [Op.or]: [
      { name: { [like]: term } },
      { roleTitle: { [like]: term } },
      { headline: { [like]: term } },
      { city: { [like]: term } },
      sequelize.where(sequelize.cast(sequelize.col('skills'), castType), { [like]: term }),
      ...(professionKeys.length ? [{ profession: { [Op.in]: professionKeys } }] : []),
    ],
  };
}

export function listingSearchClause(q) {
  const like = likeOp();
  const term = likeTerm(q);
  const word = q.trim().toLowerCase();
  const categories =
    word.length >= 3
      ? Object.entries(LISTING_CATEGORY_KEYWORDS)
          .filter(([, keywords]) => keywords.split(' ').some((k) => k.startsWith(word)))
          .map(([key]) => key)
      : [];
  return {
    [Op.or]: [
      { title: { [like]: term } },
      { description: { [like]: term } },
      { city: { [like]: term } },
      ...(categories.length ? [{ category: { [Op.in]: categories } }] : []),
    ],
  };
}
