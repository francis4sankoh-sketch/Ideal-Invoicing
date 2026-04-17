/**
 * Backfill draft quotes for existing website_enquiries that don't have one yet.
 * Run with: npx tsx scripts/backfill-enquiry-quotes.ts
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

type ProductRow = {
  id: string;
  name: string;
  default_price: number;
  description: string | null;
  photos: string[] | null;
};

function parseStringItem(s: string): { name: string; quantity: number } {
  const m = s.match(/^(.*?)\s*\(x\s*(\d+)\s*\)\s*$/i);
  if (m) return { name: m[1].trim(), quantity: Number(m[2]) || 1 };
  return { name: s.trim(), quantity: 1 };
}

function normaliseItems(raw: unknown[]): Array<{ name: string; quantity: number }> {
  const out: Array<{ name: string; quantity: number }> = [];
  for (const item of raw || []) {
    if (typeof item === 'string') {
      const parts = item.includes(',') && /\(x\s*\d+\s*\)/i.test(item)
        ? item.split(/,\s*(?=[^,]*\(x\s*\d+\s*\))/i)
        : [item];
      for (const part of parts) {
        const p = parseStringItem(part);
        if (p.name) out.push(p);
      }
    } else if (item && typeof item === 'object') {
      const i = item as { product_name?: string; equipment_name?: string; name?: string; quantity?: number };
      const name = i.product_name || i.equipment_name || i.name || '';
      const quantity = Number(i.quantity ?? 1) || 1;
      if (name) out.push({ name, quantity });
    }
  }
  return out;
}

function matchProduct(requested: string, products: ProductRow[]): ProductRow | null {
  const target = requested.toLowerCase().trim();
  if (!target) return null;
  const exact = products.find((p) => p.name.toLowerCase().trim() === target);
  if (exact) return exact;
  const contained = products.find(
    (p) => target.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(target)
  );
  if (contained) return contained;
  const stop = new Set(['the', 'a', 'and', 'or', 'of', 'with', 'for', '&']);
  const targetTokens = target.split(/\s+/).filter((t) => t.length > 2 && !stop.has(t));
  if (!targetTokens.length) return null;
  let best: ProductRow | null = null;
  let bestScore = 0;
  for (const p of products) {
    const nameTokens = p.name.toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !stop.has(t));
    const score = nameTokens.filter((t) => targetTokens.includes(t)).length;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

async function run() {
  const { data: enquiries } = await supabase
    .from('website_enquiries')
    .select('*')
    .is('quote_id', null)
    .eq('source', 'website')
    .order('created_at', { ascending: true });

  console.log(`Found ${enquiries?.length ?? 0} enquiries without quotes`);

  const { data: products } = await supabase
    .from('products')
    .select('id, name, default_price, description, photos');

  for (const enq of enquiries ?? []) {
    const { data: settings } = await supabase
      .from('business_settings')
      .select('id, quote_prefix, next_quote_number, default_quote_validity, default_terms')
      .limit(1)
      .single();
    if (!settings) continue;

    const quoteNumber = `${settings.quote_prefix}-${settings.next_quote_number}`;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (settings.default_quote_validity || 30));

    const normalised = normaliseItems(enq.selected_items || []);
    const lineItems = normalised.map((it) => {
      const prod = matchProduct(it.name, products || []);
      const unitPrice = prod?.default_price ?? 0;
      return {
        id: randomUUID(),
        description: it.name,
        quantity: it.quantity,
        unit_price: unitPrice,
        total: unitPrice * it.quantity,
        notes: prod?.description ?? '',
        photos: prod?.photos ?? [],
      };
    });

    const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
    const total = subtotal;
    const depositAmount = total * 0.2;
    const unmatched = lineItems.filter((li) => li.unit_price === 0).length;

    const noteLines = ['Auto-created from website enquiry (backfilled).'];
    if (unmatched > 0) noteLines.push(`${unmatched} item(s) unmatched — review pricing before sending.`);
    if (enq.additional_notes) noteLines.push('', 'Customer notes:', enq.additional_notes);

    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        customer_id: enq.customer_id,
        title: enq.event_type ? `${enq.event_type} — website enquiry` : `Website Enquiry — ${enq.name}`,
        event_date: enq.event_date,
        event_location: enq.event_location,
        line_items: lineItems,
        photos: [],
        subtotal,
        discount_type: null,
        discount_value: 0,
        discount_amount: 0,
        include_gst: false,
        gst_amount: 0,
        total,
        deposit_percentage: 20,
        deposit_amount: depositAmount,
        status: 'draft',
        valid_until: validUntil.toISOString().split('T')[0],
        notes: noteLines.join('\n'),
        terms: settings.default_terms,
      })
      .select('id')
      .single();

    if (qErr || !quote) {
      console.error(`  FAIL ${enq.name}: ${qErr?.message}`);
      continue;
    }

    await supabase
      .from('business_settings')
      .update({ next_quote_number: settings.next_quote_number + 1 })
      .eq('id', settings.id);

    await supabase
      .from('website_enquiries')
      .update({ quote_id: quote.id })
      .eq('id', enq.id);

    console.log(`  OK ${quoteNumber} for ${enq.name}: ${lineItems.length} items, $${total}${unmatched > 0 ? ` (${unmatched} unmatched)` : ''}`);
  }
}

run().catch(console.error);
