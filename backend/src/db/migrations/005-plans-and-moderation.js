import { DataTypes } from 'sequelize';

export async function up({ context: qi }) {
  await qi.createTable('plans', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING(60), allowNull: false },
    description: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    price: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
    interval: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'month' },
    features: { type: DataTypes.JSON, allowNull: false },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });

  await qi.addColumn('users', 'planId', {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'plans', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });
  await qi.addColumn('users', 'planExpiresAt', { type: DataTypes.DATE, allowNull: true });
  await qi.addColumn('users', 'suspendedAt', { type: DataTypes.DATE, allowNull: true });
  await qi.addIndex('users', ['planId']);
}

export async function down({ context: qi }) {
  for (const column of ['suspendedAt', 'planExpiresAt', 'planId']) await qi.removeColumn('users', column);
  await qi.dropTable('plans');
}
