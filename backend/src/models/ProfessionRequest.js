import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'];

export class ProfessionRequest extends Model {
  toPublic() {
    return {
      id: this.id,
      label: this.label,
      category: this.category,
      note: this.note,
      status: this.status,
      professionKey: this.professionKey,
      reviewNote: this.reviewNote,
      reviewedAt: this.reviewedAt,
      createdAt: this.createdAt,
    };
  }
}

ProfessionRequest.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    label: { type: DataTypes.STRING(60), allowNull: false },
    category: { type: DataTypes.STRING(24), allowNull: false },
    note: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending', validate: { isIn: [REQUEST_STATUSES] } },
    professionKey: { type: DataTypes.STRING(48), allowNull: true },
    reviewedById: { type: DataTypes.UUID, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    reviewNote: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
  },
  {
    sequelize,
    modelName: 'ProfessionRequest',
    tableName: 'profession_requests',
    indexes: [{ fields: ['status', 'createdAt'] }, { fields: ['userId'] }],
  },
);
