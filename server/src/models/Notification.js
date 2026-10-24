import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export const NOTIFICATION_TYPES = ['connection_request', 'connection_accepted'];

export class Notification extends Model {}

Notification.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Recipient. */
    userId: { type: DataTypes.UUID, allowNull: false },
    /** Member who triggered the notification. */
    actorId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING(32), allowNull: false, validate: { isIn: [NOTIFICATION_TYPES] } },
    /** Related record, e.g. the connection id. */
    entityId: { type: DataTypes.UUID, allowNull: true },
    readAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    indexes: [{ fields: ['userId', 'createdAt'] }, { fields: ['userId', 'readAt'] }, { fields: ['entityId'] }],
  },
);
