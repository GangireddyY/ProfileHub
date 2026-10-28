import { DataTypes } from 'sequelize';

const id = () => ({ type: DataTypes.UUID, primaryKey: true, allowNull: false });
const timestamps = () => ({
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
});
const userRef = (allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model: 'users', key: 'id' },
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

export async function up({ context: qi }) {
  await qi.createTable('users', {
    id: id(),
    name: { type: DataTypes.STRING(80), allowNull: false },
    email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    passwordChangedAt: { type: DataTypes.DATE, allowNull: true },
    headline: { type: DataTypes.STRING(160), allowNull: false, defaultValue: '' },
    profession: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'other' },
    roleTitle: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    bio: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    skills: { type: DataTypes.JSON, allowNull: false },
    experienceYears: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    city: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    avatarUrl: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
    latitude: { type: DataTypes.DOUBLE, allowNull: true },
    longitude: { type: DataTypes.DOUBLE, allowNull: true },
    locationUpdatedAt: { type: DataTypes.DATE, allowNull: true },
    shareLocation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    showOnlineStatus: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    discoverable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    discoveryRadiusKm: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
    isOnline: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true },
    ...timestamps(),
  });
  await qi.addIndex('users', ['profession']);
  await qi.addIndex('users', ['latitude', 'longitude']);

  await qi.createTable('connections', {
    id: id(),
    requesterId: userRef(),
    addresseeId: userRef(),
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    respondedAt: { type: DataTypes.DATE, allowNull: true },
    ...timestamps(),
  });
  await qi.addIndex('connections', ['requesterId', 'addresseeId'], { unique: true });
  await qi.addIndex('connections', ['addresseeId', 'status']);
  await qi.addIndex('connections', ['requesterId', 'status']);

  await qi.createTable('messages', {
    id: id(),
    senderId: userRef(),
    receiverId: userRef(),
    body: { type: DataTypes.TEXT, allowNull: false },
    readAt: { type: DataTypes.DATE, allowNull: true },
    ...timestamps(),
  });
  await qi.addIndex('messages', ['senderId', 'receiverId', 'createdAt']);
  await qi.addIndex('messages', ['receiverId', 'readAt']);

  await qi.createTable('experiences', {
    id: id(),
    userId: userRef(),
    kind: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'work' },
    title: { type: DataTypes.STRING(100), allowNull: false },
    organization: { type: DataTypes.STRING(120), allowNull: false },
    location: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    startDate: { type: DataTypes.STRING(7), allowNull: false },
    endDate: { type: DataTypes.STRING(7), allowNull: true },
    current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    ...timestamps(),
  });
  await qi.addIndex('experiences', ['userId', 'kind']);

  await qi.createTable('notifications', {
    id: id(),
    userId: userRef(),
    actorId: userRef(),
    type: { type: DataTypes.STRING(32), allowNull: false },
    entityId: { type: DataTypes.UUID, allowNull: true },
    readAt: { type: DataTypes.DATE, allowNull: true },
    ...timestamps(),
  });
  await qi.addIndex('notifications', ['userId', 'createdAt']);
  await qi.addIndex('notifications', ['userId', 'readAt']);
  await qi.addIndex('notifications', ['entityId']);
}

export async function down({ context: qi }) {
  for (const table of ['notifications', 'experiences', 'messages', 'connections', 'users']) {
    await qi.dropTable(table);
  }
}
