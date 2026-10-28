import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export const REPORT_TARGETS = ['user', 'listing', 'conversation', 'review'];
export const REPORT_REASONS = ['spam', 'scam', 'harassment', 'fake', 'inappropriate', 'misuse', 'prohibited', 'other'];
export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'];

/** A member flagging a profile, listing or conversation for the admins to review. */
export class Report extends Model {
  toPublic() {
    return {
      id: this.id,
      targetType: this.targetType,
      targetId: this.targetId,
      targetUserId: this.targetUserId,
      reason: this.reason,
      details: this.details,
      status: this.status,
      resolutionNote: this.resolutionNote,
      reviewedAt: this.reviewedAt,
      createdAt: this.createdAt,
    };
  }
}

Report.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    reporterId: { type: DataTypes.UUID, allowNull: true },
    targetType: { type: DataTypes.STRING(16), allowNull: false, validate: { isIn: [REPORT_TARGETS] } },
    targetId: { type: DataTypes.UUID, allowNull: false },
    targetUserId: { type: DataTypes.UUID, allowNull: true },
    reason: { type: DataTypes.STRING(24), allowNull: false, validate: { isIn: [REPORT_REASONS] } },
    details: { type: DataTypes.STRING(1000), allowNull: false, defaultValue: '' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'open', validate: { isIn: [REPORT_STATUSES] } },
    resolutionNote: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    reviewedById: { type: DataTypes.UUID, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Report',
    tableName: 'reports',
    indexes: [{ fields: ['status', 'createdAt'] }, { fields: ['targetUserId'] }],
  },
);
