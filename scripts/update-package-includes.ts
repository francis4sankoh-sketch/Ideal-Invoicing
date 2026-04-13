/**
 * Update product descriptions with Package Includes data
 * Run with: npx tsx scripts/update-package-includes.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const packageIncludes: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, '../../package-includes.json'), 'utf-8')
);

async function run() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, description');

  if (error || !products) {
    console.error('Failed to fetch products:', error?.message);
    return;
  }

  let updated = 0;

  for (const [name, includes] of Object.entries(packageIncludes)) {
    const product = products.find((p: { name: string }) => p.name === name);
    if (!product) {
      console.log(`  SKIP (not found): ${name}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({ description: includes })
      .eq('id', product.id);

    if (updateError) {
      console.error(`  FAILED: ${name} — ${updateError.message}`);
    } else {
      console.log(`  Updated: ${name}`);
      updated++;
    }
  }

  console.log(`\nDone! Updated ${updated}/${Object.keys(packageIncludes).length} products.`);
}

run().catch(console.error);
