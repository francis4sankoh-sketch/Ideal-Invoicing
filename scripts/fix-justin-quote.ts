/**
 * Fix the Justin Anand quote — update line item prices using correct product lookups.
 * Run with: npx tsx scripts/fix-justin-quote.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Map Base44 equipment names to the actual product names in Supabase
const items = [
  { product_name: 'Tiffany Chairs', quantity: 60, label: 'White Tiffany Chairs' },
  { product_name: 'Event Tables', quantity: 12, label: '6ft Trestle Tables' },
];

async function run() {
  // Find the Justin quote
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, deposit_percentage')
    .eq('quote_number', 'Q-1007')
    .single();

  if (!quote) {
    console.error('Quote Q-1007 not found');
    process.exit(1);
  }

  // Lookup products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, default_price, description, photos');

  const byName = new Map(products!.map((p) => [p.name.toLowerCase(), p]));

  const lineItems = items.map((it) => {
    const p = byName.get(it.product_name.toLowerCase())!;
    return {
      id: randomUUID(),
      description: it.label,
      quantity: it.quantity,
      unit_price: p.default_price,
      total: p.default_price * it.quantity,
      notes: p.description ?? '',
      photos: p.photos ?? [],
    };
  });

  const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
  const total = subtotal;
  const depositAmount = total * (quote.deposit_percentage / 100);

  const { error } = await supabase
    .from('quotes')
    .update({
      line_items: lineItems,
      subtotal,
      total,
      deposit_amount: depositAmount,
    })
    .eq('id', quote.id);

  if (error) {
    console.error('Update failed:', error.message);
    process.exit(1);
  }

  console.log(`Updated quote ${quote.quote_number}`);
  for (const li of lineItems) {
    console.log(`  ${li.quantity}x ${li.description} @ $${li.unit_price} = $${li.total}`);
  }
  console.log(`Subtotal: $${subtotal} · Total: $${total} · Deposit (${quote.deposit_percentage}%): $${depositAmount}`);
}

run().catch(console.error);
