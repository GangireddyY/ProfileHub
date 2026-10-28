import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';
import { LISTING_CATEGORIES, LISTING_CONDITIONS, LISTING_STATUSES } from '../constants/marketplace.js';

export class Listing extends Model {
  /** Exact coordinates stay on the server; callers add a rounded distance instead. */
  toPublic() {
    return {
      id: this.id,
      sellerId: this.sellerId,
      title: this.title,
      description: this.description,
      category: this.category,
      condition: this.condition,
      price: Number(this.price),
      currency: this.currency,
      negotiable: this.negotiable,
      city: this.city,
      images: this.images || [],
      status: this.status,
      viewCount: this.viewCount,
      soldAt: this.soldAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

Listing.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sellerId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    category: { type: DataTypes.STRING(24), allowNull: false, validate: { isIn: [LISTING_CATEGORIES] } },
    condition: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'good', validate: { isIn: [LISTING_CONDITIONS] } },
    price: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
    negotiable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    city: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    latitude: { type: DataTypes.DOUBLE, allowNull: true },
    longitude: { type: DataTypes.DOUBLE, allowNull: true },
    images: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active', validate: { isIn: [LISTING_STATUSES] } },
    viewCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    soldAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Listing',
    tableName: 'listings',
    indexes: [
      { fields: ['status', 'createdAt'] },
      { fields: ['sellerId', 'status'] },
      { fields: ['category', 'status'] },
      { fields: ['latitude', 'longitude'] },
    ],
  },
);
