import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: enquiries } = await supabase
    .from('website_enquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`=== Last ${enquiries?.length ?? 0} enquiries ===\n`);
  for (const e of enquiries ?? []) {
    console.log(`- ${e.created_at}`);
    console.log(`  name: ${e.name} · email: ${e.email}`);
    console.log(`  status: ${e.status} · source: ${e.source}`);
    console.log(`  quote_id: ${e.quote_id ?? '(none)'}`);
    console.log(`  selected_items: ${JSON.stringify(e.selected_items)}`);
    console.log('');
  }

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, quote_number, title, status, customer_id, created_at, total')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('=== Last 5 quotes ===');
  for (const q of quotes ?? []) {
    console.log(`  ${q.quote_number} · ${q.status} · ${q.title} · $${q.total} · ${q.created_at}`);
  }

  const { data: settings } = await supabase
    .from('business_settings')
    .select('quote_prefix, next_quote_number')
    .limit(1)
    .single();
  console.log(`\nNext quote number: ${settings?.quote_prefix}-${settings?.next_quote_number}`);
}

run().catch(console.error);
