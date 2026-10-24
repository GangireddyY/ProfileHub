import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';
import { PROFESSIONS } from '../constants/professions.js';

export class User extends Model {
  get visiblyOnline() {
    return Boolean(this.showOnlineStatus && this.isOnline);
  }

  get hasLocation() {
    return Boolean(this.shareLocation && this.latitude != null && this.longitude != null);
  }

  /** Full profile for the account owner. */
  toSelf() {
    const { passwordHash, passwordChangedAt, ...rest } = this.get({ plain: true });
    return { ...rest, online: this.visiblyOnline, hasLocation: this.hasLocation };
  }

  /** What other members may see. Exact coordinates are never exposed. */
  toPublic() {
    return {
      id: this.id,
      name: this.name,
      headline: this.headline,
      profession: this.profession,
      roleTitle: this.roleTitle,
      bio: this.bio,
      skills: this.skills || [],
      experienceYears: this.experienceYears,
      city: this.city,
      avatarUrl: this.avatarUrl,
      online: this.visiblyOnline,
      lastSeenAt: this.showOnlineStatus ? this.lastSeenAt : null,
      createdAt: this.createdAt,
    };
  }
}

User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(80), allowNull: false },
    email: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
      set(value) {
        this.setDataValue('email', String(value).trim().toLowerCase());
      },
    },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    passwordChangedAt: { type: DataTypes.DATE, allowNull: true },
    headline: { type: DataTypes.STRING(160), allowNull: false, defaultValue: '' },
    profession: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'other',
      validate: { isIn: [PROFESSIONS] },
    },
    roleTitle: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    bio: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    skills: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    experienceYears: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    city: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    avatarUrl: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },

    latitude: { type: DataTypes.DOUBLE, allowNull: true },
    longitude: { type: DataTypes.DOUBLE, allowNull: true },
    locationUpdatedAt: { type: DataTypes.DATE, allowNull: true },

    shareLocation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    showOnlineStatus: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    discoverable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    discoveryRadiusKm: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },

    isOnline: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    indexes: [{ fields: ['profession'] }, { fields: ['latitude', 'longitude'] }],
    defaultScope: { attributes: { exclude: ['passwordHash'] } },
    scopes: { withPassword: { attributes: { include: ['passwordHash'] } } },
  },
);
