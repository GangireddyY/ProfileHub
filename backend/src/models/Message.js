import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export class Message extends Model {}

Message.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    senderId: { type: DataTypes.UUID, allowNull: false },
    receiverId: { type: DataTypes.UUID, allowNull: false },
    /** Empty for photo-only and deleted messages. */
    body: { type: DataTypes.TEXT, allowNull: false },
    readAt: { type: DataTypes.DATE, allowNull: true },
    /** Photos: [{ url, width, height }]. */
    attachments: { type: DataTypes.JSON, allowNull: true },
    editedAt: { type: DataTypes.DATE, allowNull: true },
    /** Deleted for everyone: body and photos are wiped, the bubble shows "This message was deleted". */
    deletedAt: { type: DataTypes.DATE, allowNull: true },
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
