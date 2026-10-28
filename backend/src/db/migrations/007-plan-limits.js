import { DataTypes } from 'sequelize';

/** Starting entitlements for plans created before limits existed, matched by name. */
const PRESETS = {
  pro: {
    maxActiveListings: null,
    maxListingPhotos: 8,
    messageAnyone: true,
    priorityInDiscover: true,
    verifiedBadge: true,
    featuredListings: false,
    showContactPublicly: false,
  },
  business: {
    maxActiveListings: null,
    maxListingPhotos: 8,
    messageAnyone: true,
    priorityInDiscover: true,
    verifiedBadge: true,
    featuredListings: true,
    showContactPublicly: true,
  },
};

export async function up({ context: qi }) {
  await qi.addColumn('plans', 'limits', { type: DataTypes.JSON, allowNull: true });
  for (const [name, limits] of Object.entries(PRESETS)) {
    await qi.sequelize.query('UPDATE plans SET limits = :limits WHERE LOWER(name) = :name', {
      replacements: { limits: JSON.stringify(limits), name },
    });
  }
}

export async function down({ context: qi }) {
  await qi.removeColumn('plans', 'limits');
}
