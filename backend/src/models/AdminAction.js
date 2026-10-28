import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export const AUDIT_TARGETS = ['user', 'plan', 'plan_request', 'profession', 'profession_request', 'listing', 'report', 'review'];

/**
 * Append-only log of what admins changed. Names are copied in so the history stays readable
 * after the admin or the target account is deleted.
 */
export class AdminAction extends Model {
  toPublic() {
    return {
      id: this.id,
      adminId: this.adminId,
      adminName: this.adminName,
      action: this.action,
      targetType: this.targetType,
      targetId: this.targetId,
      targetLabel: this.targetLabel,
      summary: this.summary,
      data: this.data,
      createdAt: this.createdAt,
    };
  }
}

AdminAction.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    adminId: { type: DataTypes.UUID, allowNull: true },
    adminName: { type: DataTypes.STRING(80), allowNull: false, defaultValue: '' },
    action: { type: DataTypes.STRING(40), allowNull: false },
    targetType: { type: DataTypes.STRING(16), allowNull: false, validate: { isIn: [AUDIT_TARGETS] } },
    targetId: { type: DataTypes.STRING(64), allowNull: true },
    targetLabel: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
    summary: { type: DataTypes.STRING(400), allowNull: false, defaultValue: '' },
    data: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AdminAction',
    tableName: 'admin_actions',
    updatedAt: false,
    indexes: [{ fields: ['createdAt'] }, { fields: ['targetType', 'targetId'] }, { fields: ['adminId'] }],
  },
);
