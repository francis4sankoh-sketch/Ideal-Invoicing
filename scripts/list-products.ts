import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data } = await supabase
    .from('products')
    .select('id, name, default_price, category')
    .order('name');
  console.log(`Total products: ${data?.length ?? 0}\n`);
  for (const p of data ?? []) {
    console.log(`  ${p.name}  |  $${p.default_price}  |  ${p.category ?? '—'}`);
  }
}

run();
