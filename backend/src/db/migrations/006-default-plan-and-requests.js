import { DataTypes } from 'sequelize';

const userRef = (allowNull, onDelete) => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model: 'users', key: 'id' },
  onDelete,
  onUpdate: 'CASCADE',
});

export async function up({ context: qi }) {
  await qi.addColumn('plans', 'isDefault', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });

  await qi.createTable('plan_requests', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    userId: userRef(false, 'CASCADE'),
    planId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'plans', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    message: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    reviewNote: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    reviewedById: userRef(true, 'SET NULL'),
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await qi.addIndex('plan_requests', ['status', 'createdAt']);
  await qi.addIndex('plan_requests', ['userId', 'status']);
}

export async function down({ context: qi }) {
  await qi.dropTable('plan_requests');
  await qi.removeColumn('plans', 'isDefault');
}
