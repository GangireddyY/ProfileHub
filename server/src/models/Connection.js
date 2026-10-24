import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export const CONNECTION_STATUS = ['pending', 'accepted', 'declined'];

export class Connection extends Model {}

Connection.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    requesterId: { type: DataTypes.UUID, allowNull: false },
    addresseeId: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [CONNECTION_STATUS] },
    },
    respondedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Connection',
    tableName: 'connections',
    indexes: [
      { unique: true, fields: ['requesterId', 'addresseeId'] },
      { fields: ['addresseeId', 'status'] },
      { fields: ['requesterId', 'status'] },
    ],
  },
);
