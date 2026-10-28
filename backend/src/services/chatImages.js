import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { badRequest } from '../utils/http.js';

export const CHAT_IMAGE_DIR = path.resolve(env.uploadDir, 'messages');
export const CHAT_IMAGE_PREFIX = '/uploads/messages/';
export const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_CHAT_IMAGES = 4;
export const CHAT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/**
 * Re-encode to WebP (max 1600px) so we never serve user-supplied bytes as-is; this also strips
 * EXIF data such as the GPS position a phone camera stores. Names are random and unguessable.
 */
export async function saveChatImage(buffer) {
  await fs.mkdir(CHAT_IMAGE_DIR, { recursive: true });
  const filename = `${crypto.randomBytes(16).toString('hex')}.webp`;
  try {
    const info = await sharp(buffer, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(CHAT_IMAGE_DIR, filename));
    return { url: CHAT_IMAGE_PREFIX + filename, width: info.width, height: info.height };
  } catch {
    throw badRequest('One of the files is not a supported image');
  }
}

export async function removeChatImages(attachments = []) {
  await Promise.all(
    (attachments || [])
      .map((a) => a?.url)
      .filter((url) => url?.startsWith(CHAT_IMAGE_PREFIX))
      .map((url) => fs.unlink(path.join(CHAT_IMAGE_DIR, path.basename(url))).catch(() => {})),
  );
}
