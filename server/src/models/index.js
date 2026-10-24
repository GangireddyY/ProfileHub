import { sequelize } from '../config/db.js';
import { migrator } from '../db/migrator.js';
import { User } from './User.js';
import { Connection } from './Connection.js';
import { Message } from './Message.js';
import { Experience } from './Experience.js';
import { Notification } from './Notification.js';

User.hasMany(Connection, { foreignKey: 'requesterId', as: 'sentRequests', onDelete: 'CASCADE' });
User.hasMany(Connection, { foreignKey: 'addresseeId', as: 'receivedRequests', onDelete: 'CASCADE' });
Connection.belongsTo(User, { foreignKey: 'requesterId', as: 'requester' });
Connection.belongsTo(User, { foreignKey: 'addresseeId', as: 'addressee' });

User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages', onDelete: 'CASCADE' });
User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages', onDelete: 'CASCADE' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

User.hasMany(Experience, { foreignKey: 'userId', as: 'experiences', onDelete: 'CASCADE' });
Experience.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'recipient' });
Notification.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

/** Connect and apply any pending migrations. */
export async function initDb() {
  await sequelize.authenticate();
  await migrator.up();
}

export { sequelize, User, Connection, Message, Experience, Notification };
