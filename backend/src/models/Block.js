import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

/** `blockerId` no longer wants any contact with `blockedId`; applies in both directions. */
export class Block extends Model {}

Block.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    blockerId: { type: DataTypes.UUID, allowNull: false },
    blockedId: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'Block',
    tableName: 'blocks',
    indexes: [{ unique: true, fields: ['blockerId', 'blockedId'] }, { fields: ['blockedId'] }],
  },
);
