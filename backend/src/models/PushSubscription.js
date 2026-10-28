import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

/** A browser/device that agreed to receive push notifications for a member. */
export class PushSubscription extends Model {}

PushSubscription.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    endpoint: { type: DataTypes.TEXT, allowNull: false },
    /** Endpoints can be very long, so uniqueness is enforced on their hash. */
    endpointHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    p256dh: { type: DataTypes.STRING(200), allowNull: false },
    auth: { type: DataTypes.STRING(100), allowNull: false },
    userAgent: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
  },
  {
    sequelize,
    modelName: 'PushSubscription',
    tableName: 'push_subscriptions',
    indexes: [{ fields: ['userId'] }],
  },
);
