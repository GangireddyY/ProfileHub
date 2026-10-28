import { DataTypes } from 'sequelize';

const userRef = (allowNull = false, onDelete = 'CASCADE') => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model: 'users', key: 'id' },
  onDelete,
  onUpdate: 'CASCADE',
});
const timestamps = () => ({
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
});

export async function up({ context: qi }) {
  await qi.addColumn('users', 'emailVerifiedAt', { type: DataTypes.DATE, allowNull: true });
  await qi.addColumn('users', 'language', { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'en' });
  await qi.addColumn('users', 'notifyPrefs', { type: DataTypes.JSON, allowNull: true });
  // Accounts from before email verification existed were created by people we already trust.
  await qi.sequelize.query('UPDATE users SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL');

  // One-time links sent by email: verify address, reset password.
  await qi.createTable('auth_tokens', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    userId: userRef(),
    purpose: { type: DataTypes.STRING(24), allowNull: false },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    usedAt: { type: DataTypes.DATE, allowNull: true },
    ...timestamps(),
  });
  await qi.addIndex('auth_tokens', ['userId', 'purpose']);

  await qi.createTable('push_subscriptions', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    userId: userRef(),
    endpoint: { type: DataTypes.TEXT, allowNull: false },
    endpointHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    p256dh: { type: DataTypes.STRING(200), allowNull: false },
    auth: { type: DataTypes.STRING(100), allowNull: false },
    userAgent: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    ...timestamps(),
  });
  await qi.addIndex('push_subscriptions', ['userId']);

  await qi.addColumn('messages', 'attachments', { type: DataTypes.JSON, allowNull: true });
  await qi.addColumn('messages', 'editedAt', { type: DataTypes.DATE, allowNull: true });
  await qi.addColumn('messages', 'deletedAt', { type: DataTypes.DATE, allowNull: true });

  // "Delete conversation" hides everything up to clearedAt for that member only.
  await qi.createTable('chat_clears', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    userId: userRef(),
    otherId: userRef(),
    clearedAt: { type: DataTypes.DATE, allowNull: false },
    ...timestamps(),
  });
  await qi.addIndex('chat_clears', ['userId', 'otherId'], { unique: true });

  await qi.createTable('admin_actions', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    adminId: userRef(true, 'SET NULL'),
    adminName: { type: DataTypes.STRING(80), allowNull: false, defaultValue: '' },
    action: { type: DataTypes.STRING(40), allowNull: false },
    targetType: { type: DataTypes.STRING(16), allowNull: false },
    targetId: { type: DataTypes.STRING(64), allowNull: true },
    targetLabel: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
    summary: { type: DataTypes.STRING(400), allowNull: false, defaultValue: '' },
    data: { type: DataTypes.JSON, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  });
  await qi.addIndex('admin_actions', ['createdAt']);
  await qi.addIndex('admin_actions', ['targetType', 'targetId']);
  await qi.addIndex('admin_actions', ['adminId']);

  await qi.createTable('reviews', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    reviewerId: userRef(),
    revieweeId: userRef(),
    rating: { type: DataTypes.INTEGER, allowNull: false },
    comment: { type: DataTypes.STRING(1000), allowNull: false, defaultValue: '' },
    ...timestamps(),
  });
  await qi.addIndex('reviews', ['reviewerId', 'revieweeId'], { unique: true });
  await qi.addIndex('reviews', ['revieweeId', 'createdAt']);
}

export async function down({ context: qi }) {
  await qi.dropTable('reviews');
  await qi.dropTable('admin_actions');
  await qi.dropTable('chat_clears');
  for (const column of ['deletedAt', 'editedAt', 'attachments']) await qi.removeColumn('messages', column);
  await qi.dropTable('push_subscriptions');
  await qi.dropTable('auth_tokens');
  for (const column of ['notifyPrefs', 'language', 'emailVerifiedAt']) await qi.removeColumn('users', column);
}
