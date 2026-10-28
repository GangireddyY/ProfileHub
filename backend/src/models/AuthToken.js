import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export const TOKEN_PURPOSES = ['verify_email', 'reset_password'];

/** One-time link sent by email. Only the SHA-256 hash of the token is stored. */
export class AuthToken extends Model {}

AuthToken.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    purpose: { type: DataTypes.STRING(24), allowNull: false, validate: { isIn: [TOKEN_PURPOSES] } },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    usedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AuthToken',
    tableName: 'auth_tokens',
    indexes: [{ fields: ['userId', 'purpose'] }],
  },
);
