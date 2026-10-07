import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  sendQuoteAcceptedNotification,
  sendQuoteRejectedNotification,
  sendNewMessageNotification,
} from '@/lib/resend/emails';
import { formatCurrency } from '@/lib/utils/format';

// The portal has no login: the customer's portal_token is the only credential, so every
// action re-checks it and only ever touches that customer's own quotes and invoices.

const CUSTOMER_FIELDS = 'id, contact_name, business_name, email';
const SETTINGS_FIELDS =
  'business_name, abn, logo_url, email, phone, bank_name, account_name, bsb, account_number, bank_reference_note';

type Supabase = Awaited<ReturnType<typeof createServiceRoleClient>>;

async function ownQuote(supabase: Supabase, customerId: string, quoteId: unknown) {
  if (typeof quoteId !== 'string' || !quoteId) return null;
  const { data } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('customer_id', customerId)
    .neq('status', 'draft')
    .maybeSingle();
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, token } = body;

    if (typeof token !== 'string' || !token) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const supabase = await createServiceRoleClient();
    const { data: customer } = await supabase
      .from('customers')
      .select(CUSTOMER_FIELDS)
      .eq('portal_token', token)
      .maybeSingle();

    if (!customer) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    switch (action) {
      case 'load': {
        const [quotesRes, invoicesRes, settingsRes] = await Promise.all([
          supabase.from('quotes').select('*').eq('customer_id', customer.id).neq('status', 'draft').order('created_at', { ascending: false }),
          supabase.from('invoices').select('*').eq('customer_id', customer.id).neq('status', 'draft').order('created_at', { ascending: false }),
          supabase.from('business_settings').select(SETTINGS_FIELDS).limit(1).maybeSingle(),
        ]);
        return Response.json({
          customer,
          quotes: quotesRes.data || [],
          invoices: invoicesRes.data || [],
          settings: settingsRes.data,
        });
      }

      case 'load_messages': {
        const quote = await ownQuote(supabase, customer.id, body.quoteId);
        if (!quote) return Response.json({ error: 'Not found' }, { status: 404 });
        const { data } = await supabase
          .from('quote_messages')
          .select('*')
          .eq('quote_id', quote.id)
          .order('created_at', { ascending: true });
        return Response.json({ messages: data || [] });
      }

      case 'record_view': {
        const table = body.kind === 'invoice' ? 'invoices' : body.kind === 'quote' ? 'quotes' : null;
        if (!table || typeof body.id !== 'string') return Response.json({ error: 'Bad request' }, { status: 400 });
        await supabase
          .from(table)
          .update({ last_viewed: new Date().toISOString() })
          .eq('id', body.id)
          .eq('customer_id', customer.id);
        return Response.json({ success: true });
      }

      case 'accept_quote':
      case 'reject_quote': {
        const quote = await ownQuote(supabase, customer.id, body.quoteId);
        if (!quote) return Response.json({ error: 'Not found' }, { status: 404 });
        if (quote.status !== 'sent') {
          return Response.json({ error: 'This quote can no longer be changed' }, { status: 409 });
        }
        const status = action === 'accept_quote' ? 'accepted' : 'rejected';
        const { error } = await supabase.from('quotes').update({ status }).eq('id', quote.id);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        try {
          if (status === 'accepted') {
            await sendQuoteAcceptedNotification({
              customerName: customer.contact_name,
              quoteNumber: quote.quote_number,
              total: formatCurrency(quote.total),
              depositAmount: formatCurrency(quote.deposit_amount),
            });
          } else {
            await sendQuoteRejectedNotification({
              customerName: customer.contact_name,
              quoteNumber: quote.quote_number,
              reason: typeof body.reason === 'string' ? body.reason.slice(0, 2000) : undefined,
            });
          }
        } catch (err) {
          console.error(`Quote ${status} notification failed:`, err);
        }
        return Response.json({ success: true, status });
      }

      case 'send_message': {
        const quote = await ownQuote(supabase, customer.id, body.quoteId);
        const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : '';
        if (!quote) return Response.json({ error: 'Not found' }, { status: 404 });
        if (!message) return Response.json({ error: 'Message is empty' }, { status: 400 });

        const { error } = await supabase.from('quote_messages').insert({
          quote_id: quote.id,
          sender_type: 'customer',
          sender_name: customer.contact_name,
          message,
        });
        if (error) return Response.json({ error: error.message }, { status: 500 });

        try {
          await sendNewMessageNotification({
            customerName: customer.contact_name,
            quoteNumber: quote.quote_number,
            messagePreview: message.slice(0, 100),
          });
        } catch (err) {
          console.error('New message notification failed:', err);
        }
        return Response.json({ success: true });
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Portal API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
