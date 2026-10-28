import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.js';

/** One rating per pair of members, left by someone who has worked or talked with the reviewee. */
export class Review extends Model {
  toPublic() {
    return {
      id: this.id,
      reviewerId: this.reviewerId,
      revieweeId: this.revieweeId,
      rating: this.rating,
      comment: this.comment,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

Review.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    reviewerId: { type: DataTypes.UUID, allowNull: false },
    revieweeId: { type: DataTypes.UUID, allowNull: false },
    rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    comment: { type: DataTypes.STRING(1000), allowNull: false, defaultValue: '' },
  },
  {
    sequelize,
    modelName: 'Review',
    tableName: 'reviews',
    indexes: [{ unique: true, fields: ['reviewerId', 'revieweeId'] }, { fields: ['revieweeId', 'createdAt'] }],
  },
);
