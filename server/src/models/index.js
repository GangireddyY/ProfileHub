import { sequelize } from '../config/db.js';
import { User } from './User.js';
import { Connection } from './Connection.js';
import { Message } from './Message.js';

User.hasMany(Connection, { foreignKey: 'requesterId', as: 'sentRequests', onDelete: 'CASCADE' });
User.hasMany(Connection, { foreignKey: 'addresseeId', as: 'receivedRequests', onDelete: 'CASCADE' });
Connection.belongsTo(User, { foreignKey: 'requesterId', as: 'requester' });
Connection.belongsTo(User, { foreignKey: 'addresseeId', as: 'addressee' });

User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages', onDelete: 'CASCADE' });
User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages', onDelete: 'CASCADE' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

export async function initDb({ force = false } = {}) {
  await sequelize.authenticate();
  await sequelize.sync({ force });
}

export { sequelize, User, Connection, Message };
