import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export const EXPERIENCE_KINDS = ['work', 'education'];

export class Experience extends Model {}

Experience.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'work', validate: { isIn: [EXPERIENCE_KINDS] } },
    /** Job title for work, degree / course for education. */
    title: { type: DataTypes.STRING(100), allowNull: false },
    /** Company for work, school for education. */
    organization: { type: DataTypes.STRING(120), allowNull: false },
    location: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    /** Month precision, stored as 'YYYY-MM'. */
    startDate: { type: DataTypes.STRING(7), allowNull: false },
    endDate: { type: DataTypes.STRING(7), allowNull: true },
    current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  },
  {
    sequelize,
    modelName: 'Experience',
    tableName: 'experiences',
    indexes: [{ fields: ['userId', 'kind'] }],
  },
);
