import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export const NOTIFICATION_TYPES = [
  'connection_request',
  'connection_accepted',
  /** Sent to admins; entityId is the profession request. */
  'profession_request',
  'profession_approved',
  'profession_rejected',
  /** Sent to admins; entityId is the plan request. */
  'plan_request',
  'plan_approved',
  'plan_rejected',
  /** Sent to admins; the actor is the new member waiting for approval. */
  'signup_request',
  'account_approved',
  /** Sent to admins; entityId is the report. */
  'report_new',
  /** System notices: no actor; details live in `data`. */
  'listing_removed',
  'plan_expiring',
  'plan_expired',
  /** The actor rated the recipient; entityId is the review. */
  'review_new',
];

export class Notification extends Model {}

Notification.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Recipient. */
    userId: { type: DataTypes.UUID, allowNull: false },
    /** Member who triggered the notification; null for system notices. */
    actorId: { type: DataTypes.UUID, allowNull: true },
    type: { type: DataTypes.STRING(32), allowNull: false, validate: { isIn: [NOTIFICATION_TYPES] } },
    /** Related record, e.g. the connection id. */
    entityId: { type: DataTypes.UUID, allowNull: true },
    readAt: { type: DataTypes.DATE, allowNull: true },
    /** Extra details for the message, e.g. { title, reason } of a removed listing. */
    data: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    indexes: [{ fields: ['userId', 'createdAt'] }, { fields: ['userId', 'readAt'] }, { fields: ['entityId'] }],
  },
);
