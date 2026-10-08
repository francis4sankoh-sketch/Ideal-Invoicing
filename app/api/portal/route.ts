import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  sendQuoteAcceptedNotification,
  sendQuoteRejectedNotification,
  sendNewMessageNotification,
} from '@/lib/resend/emails';
import { formatCurrency } from '@/lib/utils/format';
import { sendTelegram } from '@/lib/notify/telegram';
import { customerMessageAlert, threadColumn, type ThreadKind } from '@/lib/messages/thread';

// The portal has no login: the customer's portal_token is the only credential, so every
// action re-checks it and only ever touches that customer's own quotes and invoices.

const CUSTOMER_FIELDS = 'id, contact_name, business_name, email';
const SETTINGS_FIELDS =
  'business_name, abn, logo_url, email, phone, bank_name, account_name, bsb, account_number, bank_reference_note';

type Supabase = Awaited<ReturnType<typeof createServiceRoleClient>>;

async function ownDoc(supabase: Supabase, customerId: string, kind: ThreadKind, id: unknown) {
  if (typeof id !== 'string' || !id) return null;
  const { data } = await supabase
    .from(kind === 'quote' ? 'quotes' : 'invoices')
    .select('*')
    .eq('id', id)
    .eq('customer_id', customerId)
    .neq('status', 'draft')
    .maybeSingle();
  return data;
}

const ownQuote = (supabase: Supabase, customerId: string, quoteId: unknown) =>
  ownDoc(supabase, customerId, 'quote', quoteId);

function threadKind(value: unknown): ThreadKind | null {
  return value === 'quote' || value === 'invoice' ? value : null;
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
        const kind = threadKind(body.kind);
        const doc = kind ? await ownDoc(supabase, customer.id, kind, body.id) : null;
        if (!kind || !doc) return Response.json({ error: 'Not found' }, { status: 404 });
        const { data } = await supabase
          .from('quote_messages')
          .select('*')
          .eq(threadColumn(kind), doc.id)
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
        const kind = threadKind(body.kind);
        const doc = kind ? await ownDoc(supabase, customer.id, kind, body.id) : null;
        const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : '';
        if (!kind || !doc) return Response.json({ error: 'Not found' }, { status: 404 });
        if (!message) return Response.json({ error: 'Message is empty' }, { status: 400 });

        const { error } = await supabase.from('quote_messages').insert({
          [threadColumn(kind)]: doc.id,
          sender_type: 'customer',
          sender_name: customer.contact_name,
          message,
        });
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const number = kind === 'quote' ? doc.quote_number : doc.invoice_number;
        const label = `${kind === 'quote' ? 'quote' : 'invoice'} ${number}`;
        const [emailResult, telegramResult] = await Promise.allSettled([
          sendNewMessageNotification({
            customerName: customer.contact_name,
            documentLabel: label,
            messagePreview: message.slice(0, 100),
            appPath: `/${kind === 'quote' ? 'quotes' : 'invoices'}/${doc.id}`,
          }),
          sendTelegram(customerMessageAlert({ customerName: customer.contact_name, label, message, kind, id: doc.id })),
        ]);
        if (emailResult.status === 'rejected') console.error('New message email failed:', emailResult.reason);
        if (telegramResult.status === 'rejected') console.error('New message Telegram alert failed:', telegramResult.reason);
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
