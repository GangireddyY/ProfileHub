import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { badRequest } from '../utils/http.js';

export const AVATAR_DIR = path.resolve(env.uploadDir, 'avatars');
export const AVATAR_PUBLIC_PREFIX = '/uploads/avatars/';
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/** Normalise any uploaded image to a 400x400 WebP so we never serve user-supplied bytes as-is. */
export async function saveAvatar(userId, buffer) {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
  const filename = `${userId}-${Date.now()}.webp`;
  try {
    await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(400, 400, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toFile(path.join(AVATAR_DIR, filename));
  } catch {
    throw badRequest('That file is not a supported image');
  }
  return AVATAR_PUBLIC_PREFIX + filename;
}

export async function removeAvatarFile(avatarUrl) {
  if (!avatarUrl?.startsWith(AVATAR_PUBLIC_PREFIX)) return;
  const file = path.join(AVATAR_DIR, path.basename(avatarUrl));
  await fs.unlink(file).catch(() => {});
}
