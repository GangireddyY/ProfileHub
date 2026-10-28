import { DataTypes } from 'sequelize';

export async function up({ context: qi }) {
  await qi.addColumn('users', 'locationDetails', { type: DataTypes.JSON, allowNull: true });
}

export async function down({ context: qi }) {
  await qi.removeColumn('users', 'locationDetails');
}
