import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    accessToken: {
      type: String,
      required: [true, 'Access token is required'],
    },
    refreshToken: {
      type: String,
      required: [true, 'Refresh token is required'],
    },
    accessTokenValidUntil: {
      type: Date,
      required: [true, 'Access token expiration date is required'],
    },
    refreshTokenValidUntil: {
      type: Date,
      required: [true, 'Refresh token expiration date is required'],
    },
  },
  {
    versionKey: false,
    timestamps: true, // Додає createdAt та updatedAt для відстеження сесій
  },
);

// Індекси для оптимізації пошуку
sessionSchema.index({ userId: 1 });
sessionSchema.index({ accessToken: 1 });
sessionSchema.index({ refreshToken: 1 });

// Індекс для автоматичного видалення застарілих сесій
sessionSchema.index({ refreshTokenValidUntil: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model('Session', sessionSchema);
