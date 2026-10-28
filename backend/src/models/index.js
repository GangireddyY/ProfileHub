import bcrypt from 'bcryptjs';
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
import { Plan } from './Plan.js';
import { PlanRequest } from './PlanRequest.js';
import { Session } from './Session.js';
import { Report } from './Report.js';
import { Block } from './Block.js';
import { AuthToken } from './AuthToken.js';
import { PushSubscription } from './PushSubscription.js';
import { ChatClear } from './ChatClear.js';
import { AdminAction } from './AdminAction.js';
import { Review } from './Review.js';
import { ensureDefaultPlan } from '../services/plans.js';

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

Plan.hasMany(User, { foreignKey: 'planId', as: 'subscribers' });
User.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });

PlanRequest.belongsTo(User, { foreignKey: 'userId', as: 'requester' });
PlanRequest.belongsTo(User, { foreignKey: 'reviewedById', as: 'reviewer' });
PlanRequest.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });
User.hasMany(PlanRequest, { foreignKey: 'userId', as: 'planRequests', onDelete: 'CASCADE' });

User.hasMany(Session, { foreignKey: 'userId', as: 'sessions', onDelete: 'CASCADE' });
Session.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Report.belongsTo(User, { foreignKey: 'reporterId', as: 'reporter' });
Report.belongsTo(User, { foreignKey: 'targetUserId', as: 'targetUser' });
Report.belongsTo(User, { foreignKey: 'reviewedById', as: 'reviewer' });

Block.belongsTo(User, { foreignKey: 'blockedId', as: 'blocked' });

Review.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });
Review.belongsTo(User, { foreignKey: 'revieweeId', as: 'reviewee' });

/**
 * Creates the ADMIN_EMAIL account on first start. An existing *member* account with that email is never
 * promoted: anyone could have signed up with it first, so taking it over would hand them admin rights.
 */
async function ensureAdminAccount() {
  const { email, password, name } = env.adminAccount;
  if (!email) return;
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    if (existing.role !== 'admin') {
      console.warn(
        `ADMIN_EMAIL ${email} belongs to a member account that was not created as an admin, so it was not promoted. ` +
          'Use a different ADMIN_EMAIL, or promote that account from the admin panel if it is really yours.',
      );
      return;
    }
    if (existing.suspendedAt || existing.approvalStatus !== 'approved') {
      await existing.update({ suspendedAt: null, approvalStatus: 'approved' });
    }
    return;
  }
  if (password.length < 8) {
    console.warn('ADMIN_EMAIL is set but ADMIN_PASSWORD is missing or shorter than 8 characters; admin not created.');
    return;
  }
  await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'admin',
    approvalStatus: 'approved',
    emailVerifiedAt: new Date(),
    profession: 'other',
  });
  console.log(`Created admin account ${email}. You can now remove ADMIN_PASSWORD from .env.`);
}

/** Connect, apply any pending migrations and set up the admin account from the environment. */
export async function initDb() {
  await sequelize.authenticate();
  await migrator.up();
  await ensureAdminAccount();
  await ensureDefaultPlan();
}

export {
  sequelize,
  User,
  Connection,
  Message,
  Experience,
  Notification,
  Profession,
  ProfessionRequest,
  Listing,
  Plan,
  PlanRequest,
  Session,
  Report,
  Block,
  AuthToken,
  PushSubscription,
  ChatClear,
  AdminAction,
  Review,
};
