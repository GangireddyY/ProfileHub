import { DataTypes } from 'sequelize';

const COLUMNS = {
  contactEmail: { type: DataTypes.STRING(160), allowNull: false, defaultValue: '' },
  phone: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '' },
  address: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
};

export async function up({ context: qi }) {
  for (const [name, spec] of Object.entries(COLUMNS)) await qi.addColumn('users', name, spec);
}

export async function down({ context: qi }) {
  for (const name of Object.keys(COLUMNS).reverse()) await qi.removeColumn('users', name);
}
