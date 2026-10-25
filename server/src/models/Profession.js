import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

export class Profession extends Model {
  toPublic() {
    return { key: this.key, label: this.label, category: this.category, icon: this.icon, hue: this.hue, active: this.active };
  }
}

Profession.init(
  {
    key: { type: DataTypes.STRING(48), primaryKey: true },
    label: { type: DataTypes.STRING(60), allowNull: false },
    category: { type: DataTypes.STRING(24), allowNull: false },
    icon: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'Briefcase' },
    hue: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 220 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdById: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Profession',
    tableName: 'professions',
    indexes: [{ fields: ['category'] }, { fields: ['label'] }],
  },
);
