import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

/** `userId` deleted their conversation with `otherId`: messages up to `clearedAt` are hidden for them only. */
export class ChatClear extends Model {}

ChatClear.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    otherId: { type: DataTypes.UUID, allowNull: false },
    clearedAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    modelName: 'ChatClear',
    tableName: 'chat_clears',
    indexes: [{ unique: true, fields: ['userId', 'otherId'] }],
  },
);
