import { Op } from 'sequelize';
import { sequelize } from '../config/db.js';
import { env } from '../config/env.js';
import { migrator } from '../db/migrator.js';
import { User } from './User.js';
import { Connection } from './Connection.js';
import { Message } from './Message.js';
import { Experience } from './Experience.js';
import { Notification } from './Notification.js';
import { Profession } from './Profession.js';
import { ProfessionRequest } from './ProfessionRequest.js';
import { Listing } from './Listing.js';

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

User.hasMany(ProfessionRequest, { foreignKey: 'userId', as: 'professionRequests', onDelete: 'CASCADE' });
ProfessionRequest.belongsTo(User, { foreignKey: 'userId', as: 'requester' });
ProfessionRequest.belongsTo(User, { foreignKey: 'reviewedById', as: 'reviewer' });

User.hasMany(Listing, { foreignKey: 'sellerId', as: 'listings', onDelete: 'CASCADE' });
Listing.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

/** Connect, apply any pending migrations and promote the accounts listed in ADMIN_EMAILS. */
export async function initDb() {
  await sequelize.authenticate();
  await migrator.up();
  if (env.adminEmails.length) {
    await User.update({ role: 'admin' }, { where: { email: { [Op.in]: env.adminEmails }, role: { [Op.ne]: 'admin' } } });
  }
}

export { sequelize, User, Connection, Message, Experience, Notification, Profession, ProfessionRequest, Listing };
