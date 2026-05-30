/**
 * Ensure the `quotes` storage bucket exists and is public.
 * Idempotent — safe to run multiple times.
 * Run with: npx tsx scripts/ensure-quotes-bucket.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = 'quotes';

async function run() {
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error('Failed to list buckets:', listErr.message);
    process.exit(1);
  }

  const existing = buckets?.find((b) => b.name === BUCKET);
  if (existing) {
    console.log(`Bucket "${BUCKET}" already exists (public: ${existing.public}).`);
    if (!existing.public) {
      const { error: updateErr } = await supabase.storage.updateBucket(BUCKET, { public: true });
      if (updateErr) {
        console.error('Failed to make bucket public:', updateErr.message);
        process.exit(1);
      }
      console.log('Made bucket public.');
    }
    return;
  }

  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB per file
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  if (createErr) {
    console.error('Failed to create bucket:', createErr.message);
    process.exit(1);
  }
  console.log(`Created bucket "${BUCKET}" (public, 5MB limit, image/jpeg+png+webp).`);
}

run().catch(console.error);
