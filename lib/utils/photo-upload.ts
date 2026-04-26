/**
 * Shared helpers for uploading line-item photos to the `quotes` storage
 * bucket, with HEIC → JPEG conversion and client-side resize.
 *
 * Photos are stored at: `quotes/line-items/<line_item_id>/<random>.jpg`
 * so cleanup can be done by line-item-id (no need to know the parent quote).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'quotes';
const PREFIX = 'line-items';
const MAX_DIMENSION = 1200; // px on longest edge
const JPEG_QUALITY = 0.85;

const ACCEPTED = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

export function isAcceptedFile(file: File): boolean {
  if (ACCEPTED.has(file.type.toLowerCase())) return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

/**
 * Convert a HEIC/HEIF file to JPEG using heic2any (client-side, browser only).
 * Returns the original file unchanged if not HEIC.
 */
async function convertHeicIfNeeded(file: File): Promise<File> {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif');
  if (!isHeic) return file;

  // Dynamic import — heic2any is client-only
  const heic2any = (await import('heic2any')).default;
  const blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: JPEG_QUALITY })) as Blob;
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg' });
}

/**
 * Resize an image client-side via canvas. Output is always JPEG.
 * Returns a Blob.
 */
async function resizeImage(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  let { width, height } = img;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width >= height) {
      height = Math.round((height / width) * MAX_DIMENSION);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width / height) * MAX_DIMENSION);
      height = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

function randomFileName(): string {
  // 16 hex chars, plenty unique within a single line item folder
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${out}.jpg`;
}

/**
 * Upload a single photo for a line item. Resizes + converts HEIC.
 * Returns the public URL of the uploaded photo.
 */
export async function uploadLineItemPhoto(
  file: File,
  lineItemId: string,
  supabase: SupabaseClient
): Promise<string> {
  if (!isAcceptedFile(file)) {
    throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }

  const converted = await convertHeicIfNeeded(file);
  const resized = await resizeImage(converted);
  const path = `${PREFIX}/${lineItemId}/${randomFileName()}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, resized, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Given a Supabase public URL like
 *   https://xxx.supabase.co/storage/v1/object/public/quotes/line-items/<id>/<file>.jpg
 * extract the storage-relative path ("line-items/<id>/<file>.jpg").
 * Returns null if the URL is not a public URL for our bucket.
 */
function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length);
}

/**
 * Delete a single photo by its public URL. Silently no-ops if the URL
 * isn't a Supabase URL we can parse (e.g. seed data with absolute URLs).
 */
export async function deletePhotoByUrl(url: string, supabase: SupabaseClient): Promise<void> {
  const path = pathFromPublicUrl(url);
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * Delete all photos that belong to the given line items. Useful when
 * deleting a whole quote or invoice — pass `quote.line_items` and we'll
 * walk every item's `photos[]` and remove any objects we own.
 */
export async function deletePhotosForLineItems(
  items: Array<{ photos?: string[] | null }>,
  supabase: SupabaseClient
): Promise<void> {
  const paths: string[] = [];
  for (const item of items) {
    for (const url of item.photos ?? []) {
      const p = pathFromPublicUrl(url);
      if (p) paths.push(p);
    }
  }
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}
