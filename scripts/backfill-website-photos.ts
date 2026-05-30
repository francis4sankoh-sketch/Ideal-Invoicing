/**
 * Backfill product photos for items inserted by sync-website-products.ts.
 * Looks up each product by name in Supabase and uploads its website photo
 * (if photos[] is empty) from idealeventshire.com.au.
 *
 * Run: npx tsx scripts/backfill-website-photos.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { lookup as mimeLookup } from 'mime-types';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = 'Products';
const HOST = 'https://idealeventshire.com.au/';

// (name, raw image path) — same data as sync-website-products.ts
const photos: Array<[string, string]> = [
  ['Brown Boho Traditional Wedding', 'ieg-Images/backdrops/Brown-Boho-Traditional-Wedding-Backdrop-Package-Ideal-Event-Hire.jpg'],
  ['Mr & Mrs Floral Arch', 'ieg-Images/backdrops/Mr-and-Mrs-Floral-Arch-Backdrop-Package-Ideal-Event-Hire.jpg'],
  ['Red Curved Backdrop Package', 'ieg-Images/backdrops/Red-Curved-Backdrop-Ideal-Event-Hire.jpg'],
  ['Purple Birthday Backdrop', 'ieg-Images/backdrops/Purple-Birthday-Party-Backdrop-Setup-Ideal-Event-Hire.JPG'],
  ['Boho Wedding Backdrop', 'ieg-Images/backdrops/Boho-Wedding-Backdrop-Peacock-Chair-Setup-Ideal-Event-Hire.JPG'],
  ['50th Anniversary Backdrop', 'ieg-Images/backdrops/50th-Anniversary-Backdrop-Package-Ideal-Event-Hire.jpg'],
  ['Boho Party Backdrop Package', 'ieg-Images/backdrops/Boho-Party-Backdrop-Package-Peacock-Chairs-Ideal-Event-Hire.jpg'],
  ['Girls 5th Birthday Party', 'ieg-Images/backdrops/Girls-5th-Birthday-Party-Package-Ideal-Event-Hire.jpg'],
  ['Oh Baby & Teddy', 'ieg-Images/backdrops/Oh-baby-Backdrop and Teddy-package-Hire-Ideal-Event-Hire.heic.jpg'],
  ['Linen Napkin Hire', 'ieg-Images/tableware/NAPKINS/Napkins Assorted.jpg'],
  ['Gold Candelabras', 'ieg-Images/tableware/Candelabras/Candelabras-Hire.jpg'],
  ['Cutlery Set', 'ieg-Images/tableware/Cutlery Set/Gold-cutlery-set-hire-Ideal.jpg'],
  ['Tiffany Chair - Ghost/Clear', 'ieg-Images/chairs-tables/Tiffany Chairs/Ghost/Clear-Ghost-Tiffany-Chair-Hire-Ideal-Event-Hire.webp'],
  ['Tiffany Chair - Gold', 'ieg-Images/chairs-tables/Tiffany Chairs/Gold/Gold-Tiffany-Chair-Hire-2-Ideal-Event-Hire.jpg'],
  ['Tiffany Chair - White', 'ieg-Images/chairs-tables/Tiffany Chairs/White/tifffany-chair-white.jpg'],
  ['Timber Crossback Chair', 'ieg-Images/chairs-tables/timber-crossback.jpg'],
  ['Blue Faux Pillar Florals', 'ieg-Images/florals/Blue Faux Pilar Florals-Hire-2-Ideal-Event-Hire.jpg.png.jpg'],
  ['Green Faux Pillar Florals', 'ieg-Images/florals/Green Faux Pilar Florals-Hire-2-Ideal-Event-Hire.jpg.png.jpg'],
  ['Pink Faux Pillar Florals', 'ieg-Images/florals/Pink Faux Pilar Florals-Hire-2-Ideal-Event-Hire.jpg.png.jpg'],
  ['Red Faux Pillar Florals', 'ieg-Images/florals/Red Faux Pilar Florals-Hire-2-Ideal-Event-Hire.jpg'],
  ['White Pillar Florals', 'ieg-Images/florals/White Pilar Florals-Hire-2-Ideal-Event-Hire.jpg.png.jpg'],
  ["Baby's Breath Pillar Florals", 'ieg-Images/florals/Babys-Breath-Pillar-Florals-Hire-Ideal-Event-Hire.jpg'],
  ['Red Aisle Runner', 'ieg-Images/Others/Red Carpet/Red-Aisle-Runner-Carpet-Hire-Ideal-Event-Hire.jpeg'],
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function fetchAndUpload(name: string, rawPath: string): Promise<string | null> {
  const url = HOST + encodeURI(rawPath);
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ! ${res.status} fetching ${url}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (rawPath.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic'].includes(ext) ? ext : 'jpg';
  const slug = slugify(name);
  const storagePath = `website-import/${slug}/${slug}-0.${safeExt}`;
  const contentType = mimeLookup(safeExt) || 'image/jpeg';

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType, upsert: true });
  if (error) {
    console.warn(`  ! upload failed: ${error.message}`);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function run() {
  console.log('=== Backfilling website photos ===\n');
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const [name, rawPath] of photos) {
    const { data: row } = await supabase
      .from('products')
      .select('id, name, photos')
      .eq('name', name)
      .maybeSingle();
    if (!row) {
      console.warn(`  ! not found in DB: ${name}`);
      failed++;
      continue;
    }
    if (row.photos && row.photos.length > 0) {
      console.log(`  - ${name} (already has photos, skip)`);
      skipped++;
      continue;
    }

    const url = await fetchAndUpload(name, rawPath);
    if (!url) {
      failed++;
      continue;
    }
    const { error } = await supabase
      .from('products')
      .update({ photos: [url] })
      .eq('id', row.id);
    if (error) {
      console.warn(`  ! update failed: ${error.message}`);
      failed++;
    } else {
      console.log(`  OK ${name}`);
      success++;
    }
  }
  console.log(`\nDone. Updated: ${success}, Skipped: ${skipped}, Failed: ${failed}`);
}

run().catch(console.error);
