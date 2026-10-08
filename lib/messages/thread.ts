import type { SupabaseClient } from '@supabase/supabase-js';
import { sendReplyToCustomer } from '@/lib/resend/emails';

// A message thread belongs to either a quote or an invoice (quote_messages.quote_id / invoice_id).
export type ThreadKind = 'quote' | 'invoice';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ideal-invoicing-delta.vercel.app';

export function threadColumn(kind: ThreadKind) {
  return kind === 'quote' ? 'quote_id' : 'invoice_id';
}

export async function loadThreadDoc(supabase: SupabaseClient, kind: ThreadKind, id: string) {
  const table = kind === 'quote' ? 'quotes' : 'invoices';
  const numberField = kind === 'quote' ? 'quote_number' : 'invoice_number';
  const { data } = await supabase
    .from(table)
    .select(`id, ${numberField}, customer:customers(contact_name, email, portal_token)`)
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Record<string, unknown> & {
    customer: { contact_name: string; email: string; portal_token: string } | null;
  };
  const number = String(row[numberField] ?? '');
  return {
    label: `${kind === 'quote' ? 'quote' : 'invoice'} ${number}`.trim(),
    number,
    customer: row.customer,
  };
}

export async function postBusinessReply(
  supabase: SupabaseClient,
  kind: ThreadKind,
  id: string,
  message: string
): Promise<{ ok: true; customerName: string; label: string; emailed: boolean } | { ok: false; error: string }> {
  const text = message.trim().slice(0, 5000);
  if (!text) return { ok: false, error: 'The reply is empty' };

  const doc = await loadThreadDoc(supabase, kind, id);
  if (!doc || !doc.customer) return { ok: false, error: `That ${kind} no longer exists` };

  const { error } = await supabase.from('quote_messages').insert({
    [threadColumn(kind)]: id,
    sender_type: 'business',
    sender_name: 'Ideal Events Hire',
    message: text,
    read: true,
  });
  if (error) return { ok: false, error: error.message };

  let emailed = false;
  try {
    await sendReplyToCustomer({
      customerEmail: doc.customer.email,
      customerName: doc.customer.contact_name,
      documentLabel: doc.label,
      message: text,
      portalUrl: `${APP_URL}/portal/${doc.customer.portal_token}?${kind}=${id}`,
    });
    emailed = true;
  } catch (err) {
    console.error('Reply email to customer failed:', err);
  }
  return { ok: true, customerName: doc.customer.contact_name, label: doc.label, emailed };
}

// The last line carries a reference so a Telegram reply to this message can find the thread.
export function customerMessageAlert(o: { customerName: string; label: string; message: string; kind: ThreadKind; id: string }) {
  return [
    `Message from ${o.customerName} on ${o.label}:`,
    '',
    o.message.slice(0, 3000),
    '',
    'Reply to this message to answer them.',
    `ref ${o.kind === 'quote' ? 'q' : 'i'}:${o.id}`,
  ].join('\n');
}

// Only the final line counts: the customer's own text sits above it, so a "ref" typed into
// their message can't redirect the owner's reply to someone else's thread.
export function parseThreadRef(text: string | undefined | null): { kind: ThreadKind; id: string } | null {
  const lastLine = (text || '').trim().split('\n').pop() || '';
  const m = lastLine.trim().match(/^ref (q|i):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (!m) return null;
  return { kind: m[1].toLowerCase() === 'q' ? 'quote' : 'invoice', id: m[2].toLowerCase() };
}
