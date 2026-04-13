/**
 * Product Migration Script — imports products from the website project
 * Run with: npx tsx scripts/migrate-products.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { lookup } from 'mime-types';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const WEBSITE_DIR = '/Users/francissankoh/Desktop/Claude/Website design';
const BUCKET = 'Products';

// Read the extracted products JSON
const productsJson = readFileSync(
  resolve(__dirname, '../../products.json'),
  'utf-8'
);
const products = JSON.parse(productsJson);

async function uploadImage(localPath: string, productName: string, index: number): Promise<string | null> {
  const fullPath = resolve(WEBSITE_DIR, localPath);

  if (!existsSync(fullPath)) {
    console.warn(`    Image not found: ${localPath}`);
    return null;
  }

  const fileBuffer = readFileSync(fullPath);
  const ext = localPath.split('.').pop()?.toLowerCase() || 'jpg';
  const cleanName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const storagePath = `${cleanName}/${cleanName}-${index}.${ext}`;
  const contentType = lookup(localPath) || 'image/jpeg';

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.warn(`    Upload failed for ${localPath}: ${error.message}`);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

async function migrate() {
  console.log(`Starting product migration — ${products.length} products...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const product of products) {
    console.log(`  Processing: ${product.name}`);

    // Upload main photos
    const uploadedPhotos: string[] = [];
    for (let i = 0; i < product.photos.length; i++) {
      const url = await uploadImage(product.photos[i], product.name, i);
      if (url) uploadedPhotos.push(url);
    }

    // Upload color variant photos
    const uploadedVariants = [];
    if (product.has_color_variants && product.color_variants.length > 0) {
      for (const variant of product.color_variants) {
        const variantPhotos: string[] = [];
        for (let i = 0; i < (variant.photos || []).length; i++) {
          const url = await uploadImage(
            variant.photos[i],
            `${product.name}-${variant.color_name}`,
            i
          );
          if (url) variantPhotos.push(url);
        }
        uploadedVariants.push({
          color_name: variant.color_name,
          hex_code: variant.hex_code || '',
          photos: variantPhotos,
        });
      }
    }

    // Insert into database
    const { error } = await supabase.from('products').insert({
      name: product.name,
      description: product.description,
      default_price: product.default_price,
      category: product.category,
      photos: uploadedPhotos,
      has_color_variants: product.has_color_variants,
      color_variants: uploadedVariants,
      gst_inclusive: product.gst_inclusive,
      is_active: product.is_active,
    });

    if (error) {
      console.error(`    FAILED: ${error.message}`);
      errorCount++;
    } else {
      console.log(`    OK — ${uploadedPhotos.length} photos uploaded`);
      successCount++;
    }
  }

  console.log(`\nProduct migration complete!`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${errorCount}`);
  console.log(`  Total: ${products.length}`);
}

migrate().catch(console.error);
