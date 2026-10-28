import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

/** A signed-in browser tab or device. Only a SHA-256 hash of its cookie token is stored. */
export class Session extends Model {
  get isActive() {
    return !this.revokedAt && new Date(this.expiresAt) > new Date();
  }

  toPublic(currentId) {
    return {
      id: this.id,
      userAgent: this.userAgent,
      ip: this.ip,
      createdAt: this.createdAt,
      lastSeenAt: this.lastSeenAt,
      expiresAt: this.expiresAt,
      current: this.id === currentId,
    };
  }
}

Session.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    userAgent: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    ip: { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
    lastSeenAt: { type: DataTypes.DATE, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    revokedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'Session', tableName: 'sessions', indexes: [{ fields: ['userId'] }] },
);
