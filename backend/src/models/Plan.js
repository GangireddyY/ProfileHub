import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';
import { CURRENCIES } from '../constants/professions.js';
import { normalizeLimits } from '../constants/planFeatures.js';

/** Billing period of a plan; `lifetime` never expires. */
export const PLAN_INTERVALS = ['month', 'quarter', 'year', 'lifetime'];
const INTERVAL_MONTHS = { month: 1, quarter: 3, year: 12 };

/** When a plan assigned now runs out, or null for lifetime plans. */
export function planExpiry(interval, from = new Date()) {
  const months = INTERVAL_MONTHS[interval];
  if (!months) return null;
  const end = new Date(from);
  end.setMonth(end.getMonth() + months);
  return end;
}

export class Plan extends Model {
  toPublic() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      currency: this.currency,
      interval: this.interval,
      features: this.features || [],
      limits: normalizeLimits(this.limits),
      active: this.active,
      isDefault: this.isDefault,
      sortOrder: this.sortOrder,
      createdAt: this.createdAt,
    };
  }
}

Plan.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(60), allowNull: false },
    description: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    price: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR', validate: { isIn: [CURRENCIES] } },
    interval: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'month', validate: { isIn: [PLAN_INTERVALS] } },
    /** Extra highlights shown to members, on top of what `limits` unlocks. */
    features: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    /** Entitlements enforced by the API; see constants/planFeatures.js. */
    limits: { type: DataTypes.JSON, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    /** Exactly one plan is the default: every member without another (unexpired) plan is on it. */
    isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { sequelize, modelName: 'Plan', tableName: 'plans' },
);
