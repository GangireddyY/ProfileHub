import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export const PLAN_REQUEST_STATUSES = ['pending', 'approved', 'rejected'];

/** A member asking the admins to move them to another plan. */
export class PlanRequest extends Model {
  toPublic() {
    return {
      id: this.id,
      userId: this.userId,
      planId: this.planId,
      plan: this.plan?.toPublic() ?? null,
      message: this.message,
      status: this.status,
      reviewNote: this.reviewNote,
      reviewedAt: this.reviewedAt,
      createdAt: this.createdAt,
    };
  }
}

PlanRequest.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    planId: { type: DataTypes.UUID, allowNull: false },
    message: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending', validate: { isIn: [PLAN_REQUEST_STATUSES] } },
    reviewNote: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    reviewedById: { type: DataTypes.UUID, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'PlanRequest',
    tableName: 'plan_requests',
    indexes: [{ fields: ['status', 'createdAt'] }, { fields: ['userId', 'status'] }],
  },
);
