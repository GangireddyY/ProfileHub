import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { badRequest } from '../utils/http.js';

export const LISTING_IMAGE_DIR = path.resolve(env.uploadDir, 'listings');
export const LISTING_IMAGE_PREFIX = '/uploads/listings/';
export const MAX_LISTING_IMAGE_BYTES = 8 * 1024 * 1024;
export const LISTING_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/** Re-encode to WebP (max 1600px) so we never serve user-supplied bytes as-is. */
export async function saveListingImage(buffer) {
  await fs.mkdir(LISTING_IMAGE_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.webp`;
  try {
    await sharp(buffer, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(LISTING_IMAGE_DIR, filename));
  } catch {
    throw badRequest('One of the files is not a supported image');
  }
  return LISTING_IMAGE_PREFIX + filename;
}

export async function removeListingImages(urls = []) {
  await Promise.all(
    urls
      .filter((url) => url?.startsWith(LISTING_IMAGE_PREFIX))
      .map((url) => fs.unlink(path.join(LISTING_IMAGE_DIR, path.basename(url))).catch(() => {})),
  );
}
