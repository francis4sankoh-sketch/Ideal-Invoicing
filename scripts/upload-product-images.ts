/**
 * Upload product images to Supabase Storage and update product records
 * Run with: npx tsx scripts/upload-product-images.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { lookup } from 'mime-types';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const WEBSITE_DIR = '/Users/francissankoh/Desktop/Claude/Website design';
const BUCKET = 'Products';

const productsJson = readFileSync(resolve(__dirname, '../../products.json'), 'utf-8');
const sourceProducts = JSON.parse(productsJson);

async function uploadImage(localPath: string, productName: string, index: number): Promise<string | null> {
  const fullPath = resolve(WEBSITE_DIR, localPath);
  if (!existsSync(fullPath)) {
    console.warn(`    Not found: ${localPath}`);
    return null;
  }

  const fileBuffer = readFileSync(fullPath);
  const ext = localPath.split('.').pop()?.toLowerCase() || 'jpg';
  const cleanName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const storagePath = `${cleanName}/${cleanName}-${index}.${ext}`;
  const contentType = lookup(localPath) || 'image/jpeg';

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType, upsert: true });

  if (error) {
    console.warn(`    Upload failed: ${error.message}`);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function run() {
  // Get existing products from DB
  const { data: dbProducts, error } = await supabase
    .from('products')
    .select('id, name');

  if (error || !dbProducts) {
    console.error('Failed to fetch products:', error?.message);
    return;
  }

  console.log(`Found ${dbProducts.length} products in DB, ${sourceProducts.length} in source\n`);

  let updated = 0;

  for (const source of sourceProducts) {
    const dbProduct = dbProducts.find((p: { name: string }) => p.name === source.name);
    if (!dbProduct) {
      console.log(`  SKIP (not in DB): ${source.name}`);
      continue;
    }

    console.log(`  Uploading: ${source.name}`);

    // Upload main photos
    const photos: string[] = [];
    for (let i = 0; i < source.photos.length; i++) {
      const url = await uploadImage(source.photos[i], source.name, i);
      if (url) photos.push(url);
    }

    // Upload variant photos
    const variants = [];
    if (source.has_color_variants && source.color_variants?.length > 0) {
      for (const v of source.color_variants) {
        const vPhotos: string[] = [];
        for (let i = 0; i < (v.photos || []).length; i++) {
          const url = await uploadImage(v.photos[i], `${source.name}-${v.color_name}`, i);
          if (url) vPhotos.push(url);
        }
        variants.push({ color_name: v.color_name, hex_code: v.hex_code || '', photos: vPhotos });
      }
    }

    // Update DB record
    const updateData: Record<string, unknown> = { photos };
    if (variants.length > 0) updateData.color_variants = variants;

    const { error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', dbProduct.id);

    if (updateError) {
      console.error(`    DB update failed: ${updateError.message}`);
    } else {
      console.log(`    OK — ${photos.length} photos`);
      updated++;
    }
  }

  console.log(`\nDone! Updated ${updated}/${sourceProducts.length} products with images.`);
}

run().catch(console.error);
