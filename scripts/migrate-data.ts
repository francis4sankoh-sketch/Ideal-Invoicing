/**
 * Data Migration Script
 * Run with: npx tsx scripts/migrate-data.ts
 *
 * Before running, ensure:
 * 1. Supabase tables have been created (run the SQL migration first)
 * 2. .env.local has valid NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const existingCustomers = [
  { contact_name: 'Yang Joack', business_name: 'KANJ JJ', email: 'Yangjoack@yahoo.com.au', phone: '0432644961', city: 'Docklands', state: 'VIC' },
  { contact_name: "Madelynne D'Alberto", email: 'maddydal28@gmail.com', phone: '0400706331', city: 'Devon Meadows', state: 'VIC' },
  { contact_name: 'Eloise Willis', email: 'eloisewillis00@gmail.com', phone: '0451975180', city: 'Richmond', state: 'VIC', notes: 'From website. Event type: Wedding' },
  { contact_name: 'Nybana Riek', email: 'Nyabanad@gmail.com', phone: '0403658750', postcode: '3978', state: 'VIC' },
  { contact_name: 'Winnie.MK', email: 'winny.mk@gmail.com', phone: '0403718962', state: 'VIC' },
  { contact_name: 'AKAIR W', email: 'akair.w@outlook.com', phone: '0412448701', state: 'VIC' },
  { contact_name: 'Caroline', email: 'carolcherr@yahoo.com', phone: '0424200088' },
  { contact_name: 'Lutee', email: 'Luteedavis@hotmail.com', phone: '0403730953' },
  { contact_name: 'fr.san', email: 'francis.sankoh@ableaustralia.org.au' },
  { contact_name: 'Mduluka (Queen B)', email: 'mduluka@Yahoo.com', city: 'Glen Waverley' },
  { contact_name: 'fr', email: 'francis4sankoh@gmail.com' },
  { contact_name: 'win', email: 'galissadavies@gmail.com' },
];

async function migrate() {
  console.log('Starting data migration...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const customer of existingCustomers) {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();

    if (error) {
      console.error(`  Failed: ${customer.contact_name} (${customer.email}) - ${error.message}`);
      errorCount++;
    } else {
      console.log(`  Migrated: ${customer.contact_name} (${customer.email}) -> Token: ${data.portal_token.slice(0, 8)}...`);
      successCount++;
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${errorCount}`);
  console.log(`  Total: ${existingCustomers.length}`);
}

migrate().catch(console.error);
