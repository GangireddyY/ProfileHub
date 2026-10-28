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
  // Server-side sessions: the browser only holds a random token in an httpOnly cookie.
  await qi.createTable('sessions', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    userId: userRef(),
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    userAgent: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    ip: { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
    lastSeenAt: { type: DataTypes.DATE, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    revokedAt: { type: DataTypes.DATE, allowNull: true },
    ...timestamps(),
  });
  await qi.addIndex('sessions', ['userId']);

  // Accounts that existed before approvals are already trusted.
  await qi.addColumn('users', 'approvalStatus', { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'approved' });
  await qi.addColumn('users', 'approvalNote', { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' });
  await qi.addColumn('users', 'planReminderAt', { type: DataTypes.DATE, allowNull: true });
  await qi.addIndex('users', ['approvalStatus']);

  await qi.addColumn('notifications', 'data', { type: DataTypes.JSON, allowNull: true });
  await qi.changeColumn('notifications', 'actorId', { type: DataTypes.UUID, allowNull: true });

  await qi.createTable('reports', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    reporterId: userRef(true, 'SET NULL'),
    targetType: { type: DataTypes.STRING(16), allowNull: false },
    targetId: { type: DataTypes.UUID, allowNull: false },
    targetUserId: userRef(true, 'SET NULL'),
    reason: { type: DataTypes.STRING(24), allowNull: false },
    details: { type: DataTypes.STRING(1000), allowNull: false, defaultValue: '' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'open' },
    resolutionNote: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    reviewedById: userRef(true, 'SET NULL'),
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    ...timestamps(),
  });
  await qi.addIndex('reports', ['status', 'createdAt']);
  await qi.addIndex('reports', ['targetUserId']);

  await qi.createTable('blocks', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    blockerId: userRef(),
    blockedId: userRef(),
    ...timestamps(),
  });
  await qi.addIndex('blocks', ['blockerId', 'blockedId'], { unique: true });
  await qi.addIndex('blocks', ['blockedId']);
}

export async function down({ context: qi }) {
  await qi.dropTable('blocks');
  await qi.dropTable('reports');
  await qi.removeColumn('notifications', 'data');
  for (const column of ['planReminderAt', 'approvalNote', 'approvalStatus']) await qi.removeColumn('users', column);
  await qi.dropTable('sessions');
}
