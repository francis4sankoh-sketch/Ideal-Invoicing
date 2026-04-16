import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendNewEnquiryNotification } from '@/lib/resend/emails';
import { randomUUID } from 'crypto';

type SelectedItem = {
  // Flexible shape — support both the new website ({product_id, product_name, quantity})
  // and the Base44 legacy shape ({equipment_id, equipment_name, quantity}).
  product_id?: string;
  product_name?: string;
  equipment_id?: string;
  equipment_name?: string;
  name?: string;
  quantity?: number;
  notes?: string;
};

/**
 * Try to match a requested item (by name) against an actual product row.
 * Falls back to fuzzy "contains" and token overlap if exact match fails.
 */
function matchProduct(
  requestedName: string | undefined,
  products: Array<{ id: string; name: string; default_price: number; description: string | null; photos: string[] | null }>
) {
  if (!requestedName) return null;
  const target = requestedName.toLowerCase().trim();

  // Exact match
  let match = products.find((p) => p.name.toLowerCase().trim() === target);
  if (match) return match;

  // Target contains product name, or product name contains target
  match = products.find(
    (p) => target.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(target)
  );
  if (match) return match;

  // Token overlap — ignore short/common words
  const stop = new Set(['the', 'a', 'and', 'or', 'of', 'with', 'for', '&']);
  const targetTokens = target.split(/\s+/).filter((t) => t.length > 2 && !stop.has(t));
  if (targetTokens.length === 0) return null;

  let bestScore = 0;
  let best: typeof match = null;
  for (const p of products) {
    const nameTokens = p.name.toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !stop.has(t));
    const score = nameTokens.filter((t) => targetTokens.includes(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore > 0 ? best : null;
}

export async function POST(request: NextRequest) {
  try {
    const apiSecret = request.headers.get('x-api-secret');
    if (apiSecret !== process.env.ENQUIRY_API_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      event_type,
      event_date,
      event_location,
      guest_count,
      selected_items,
      additional_notes,
    } = body as {
      name?: string;
      email?: string;
      phone?: string;
      event_type?: string;
      event_date?: string;
      event_location?: string;
      guest_count?: number;
      selected_items?: SelectedItem[];
      additional_notes?: string;
    };

    if (!name || !email) {
      return Response.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const supabase = await createServiceRoleClient();
    const emailNormalised = email.toLowerCase().trim();

    // 1. Find or create customer
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('email', emailNormalised)
      .maybeSingle();

    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert({
          contact_name: name,
          email: emailNormalised,
          phone: phone || null,
          notes: event_type ? `From website. Event type: ${event_type}` : 'From website enquiry',
        })
        .select()
        .single();

      if (custError || !newCustomer) {
        return Response.json({ error: 'Failed to create customer' }, { status: 500 });
      }
      customerId = newCustomer.id;
    }

    // 2. Create the enquiry record first (so it exists even if quote creation fails)
    const { data: enquiry, error: enqError } = await supabase
      .from('website_enquiries')
      .insert({
        customer_id: customerId,
        name,
        email: emailNormalised,
        phone: phone || null,
        event_type: event_type || null,
        event_date: event_date || null,
        event_location: event_location || null,
        guest_count: guest_count || null,
        selected_items: selected_items || [],
        additional_notes: additional_notes || null,
        source: 'website',
        status: 'new',
      })
      .select()
      .single();

    if (enqError || !enquiry) {
      return Response.json({ error: 'Failed to create enquiry' }, { status: 500 });
    }

    // 3. Build a draft quote from the enquiry
    let draftQuoteId: string | null = null;
    try {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, default_price, description, photos');

      const { data: settings } = await supabase
        .from('business_settings')
        .select('id, quote_prefix, next_quote_number, default_quote_validity, default_terms')
        .limit(1)
        .single();

      if (settings) {
        const quoteNumber = `${settings.quote_prefix}-${settings.next_quote_number}`;
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + (settings.default_quote_validity || 30));

        const lineItems = (selected_items || []).map((item) => {
          const reqName = item.product_name || item.equipment_name || item.name || '';
          const qty = Number(item.quantity ?? 1) || 1;
          const product = matchProduct(reqName, products || []);
          const unitPrice = product?.default_price ?? 0;
          return {
            id: randomUUID(),
            description: reqName || product?.name || '',
            quantity: qty,
            unit_price: unitPrice,
            total: unitPrice * qty,
            notes: item.notes || product?.description || '',
            photos: product?.photos || [],
          };
        });

        const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
        const total = subtotal; // no discount, no GST by default
        const depositPct = 20;
        const depositAmount = total * (depositPct / 100);

        const title = event_type
          ? `${event_type} — website enquiry`
          : `Website Enquiry — ${name}`;

        const unmatchedCount = lineItems.filter((li) => li.unit_price === 0).length;
        const noteLines = ['Auto-created from website enquiry.'];
        if (unmatchedCount > 0) {
          noteLines.push(`${unmatchedCount} item(s) could not be matched to a product — review pricing before sending.`);
        }
        if (additional_notes) {
          noteLines.push('', 'Customer notes:', additional_notes);
        }

        const { data: quote, error: quoteErr } = await supabase
          .from('quotes')
          .insert({
            quote_number: quoteNumber,
            customer_id: customerId,
            title,
            event_date: event_date || null,
            event_location: event_location || null,
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
            notes: noteLines.join('\n'),
            terms: settings.default_terms,
          })
          .select('id')
          .single();

        if (!quoteErr && quote) {
          draftQuoteId = quote.id;

          // Increment the quote number counter
          await supabase
            .from('business_settings')
            .update({ next_quote_number: settings.next_quote_number + 1 })
            .eq('id', settings.id);

          // Link the enquiry to the quote
          await supabase
            .from('website_enquiries')
            .update({ quote_id: quote.id })
            .eq('id', enquiry.id);
        } else if (quoteErr) {
          console.error('Failed to auto-create draft quote:', quoteErr.message);
        }
      }
    } catch (quoteCreateErr) {
      console.error('Draft quote creation error:', quoteCreateErr);
      // Don't fail the enquiry if quote creation fails
    }

    // 4. Send notification email
    try {
      await sendNewEnquiryNotification({
        name,
        email,
        event_type,
        event_date,
        selected_items,
      });
    } catch (emailErr) {
      console.error('Failed to send notification email:', emailErr);
    }

    return Response.json({
      success: true,
      enquiry_id: enquiry.id,
      draft_quote_id: draftQuoteId,
      message: 'Enquiry received successfully',
    });
  } catch (error) {
    console.error('Enquiry API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
