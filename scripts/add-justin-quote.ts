/**
 * One-off: add the Justin Anand enquiry from the Base44 export as a draft quote.
 * Run with: npx tsx scripts/add-justin-quote.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Source data from Base44 export
const source = {
  customer_name: 'Justin Anand',
  customer_email: 'jjustin26208@gmail.com',
  customer_phone: '466388838',
  event_location: 'Narre Warren South',
  event_date: '2026-05-30', // 30/5/2026
  requested_items: [
    { equipment_name: 'White Tiffany Chairs', quantity: 60 },
    { equipment_name: '6ft Trestle Tables', quantity: 12 },
  ],
};

async function run() {
  console.log('=== Adding Justin Anand quote ===\n');

  // 1. Find or create the customer
  const email = source.customer_email.toLowerCase().trim();
  let customerId: string;

  const { data: existing } = await supabase
    .from('customers')
    .select('id, contact_name')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    customerId = existing.id;
    console.log(`Customer exists: ${existing.contact_name} (${customerId.slice(0, 8)}...)`);
  } else {
    const { data: created, error } = await supabase
      .from('customers')
      .insert({
        contact_name: source.customer_name,
        email,
        phone: source.customer_phone,
        notes: 'Imported from Base44 website enquiry',
      })
      .select('id')
      .single();
    if (error || !created) {
      console.error('Failed to create customer:', error?.message);
      process.exit(1);
    }
    customerId = created.id;
    console.log(`Customer created: ${source.customer_name} (${customerId.slice(0, 8)}...)`);
  }

  // 2. Look up products by name (case-insensitive, trimmed)
  const { data: allProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, name, default_price, description, photos');
  if (prodErr || !allProducts) {
    console.error('Failed to fetch products:', prodErr?.message);
    process.exit(1);
  }

  const productByName = new Map<string, (typeof allProducts)[number]>();
  for (const p of allProducts) {
    productByName.set(p.name.toLowerCase().trim(), p);
  }

  // 3. Build line items from requested items
  const lineItems = source.requested_items.map((req) => {
    const match = productByName.get(req.equipment_name.toLowerCase().trim());
    const unitPrice = match?.default_price ?? 0;
    return {
      id: randomUUID(),
      description: match?.name ?? req.equipment_name,
      quantity: req.quantity,
      unit_price: unitPrice,
      total: unitPrice * req.quantity,
      notes: match?.description ?? '',
      photos: match?.photos ?? [],
    };
  });

  const matchedCount = lineItems.filter((li) => li.unit_price > 0).length;
  console.log(`Matched ${matchedCount}/${lineItems.length} products by name`);
  for (const li of lineItems) {
    console.log(`  - ${li.quantity}x ${li.description} @ $${li.unit_price} = $${li.total}`);
  }

  // 4. Compute totals (no GST, no discount, 20% deposit)
  const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
  const total = subtotal;
  const depositPct = 20;
  const depositAmount = total * (depositPct / 100);

  // 5. Grab the next quote number from business_settings
  const { data: settings, error: settingsErr } = await supabase
    .from('business_settings')
    .select('id, quote_prefix, next_quote_number, default_quote_validity, default_terms')
    .limit(1)
    .single();

  if (settingsErr || !settings) {
    console.error('Failed to fetch business settings:', settingsErr?.message);
    process.exit(1);
  }

  const quoteNumber = `${settings.quote_prefix}-${settings.next_quote_number}`;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (settings.default_quote_validity || 30));

  // 6. Insert the quote
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .insert({
      quote_number: quoteNumber,
      customer_id: customerId,
      title: 'Website Enquiry — Chairs & Tables',
      event_date: source.event_date,
      event_location: source.event_location,
      line_items: lineItems,
      photos: [],
      subtotal,
      discount_type: null,
      discount_value: 0,
      discount_amount: 0,
      include_gst: false,
      gst_amount: 0,
      total,
      deposit_percentage: depositPct,
      deposit_amount: depositAmount,
      status: 'draft',
      valid_until: validUntil.toISOString().split('T')[0],
      notes: 'Created from Base44 website enquiry import (2026-04-16)',
      terms: settings.default_terms,
    })
    .select('id')
    .single();

  if (quoteErr || !quote) {
    console.error('Failed to create quote:', quoteErr?.message);
    process.exit(1);
  }

  console.log(`\nQuote ${quoteNumber} created (${quote.id.slice(0, 8)}...)`);

  // 7. Bump next_quote_number
  await supabase
    .from('business_settings')
    .update({ next_quote_number: settings.next_quote_number + 1 })
    .eq('id', settings.id);

  // 8. Record the enquiry
  await supabase.from('website_enquiries').insert({
    customer_id: customerId,
    quote_id: quote.id,
    name: source.customer_name,
    email,
    phone: source.customer_phone,
    event_location: source.event_location,
    event_date: source.event_date,
    selected_items: source.requested_items,
    status: 'converted',
    source: 'base44_import',
  });

  console.log('Enquiry record created and linked.\n');
  console.log('=== Done ===');
}

run().catch(console.error);
