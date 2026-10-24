import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export class Message extends Model {}

Message.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    senderId: { type: DataTypes.UUID, allowNull: false },
    receiverId: { type: DataTypes.UUID, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    readAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Message',
    tableName: 'messages',
    indexes: [
      { fields: ['senderId', 'receiverId', 'createdAt'] },
      { fields: ['receiverId', 'readAt'] },
    ],
  },
);
