import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { buildIcs, type FeedEvent } from '@/lib/calendar/ics';
import { formatCurrency } from '@/lib/utils/format';

// Public (calendar apps can't log in), so the secret key in the URL is the only credential.
function keyMatches(given: string): boolean {
  const expected = process.env.CALENDAR_FEED_KEY;
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Row = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  updated_at: string | null;
  customer: { contact_name: string; phone: string | null; email: string | null } | null;
  invoice: { id: string; invoice_number: string; balance_due: number } | null;
};

export async function GET(request: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!keyMatches(key.replace(/\.ics$/, ''))) {
    return new Response('Not found', { status: 404 });
  }

  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, title, start_time, end_time, location, notes, updated_at, customer:customers(contact_name, phone, email), invoice:invoices(id, invoice_number, balance_due)'
    )
    .neq('status', 'cancelled')
    .gte('end_time', since)
    .order('start_time');
  if (error) {
    console.error('Calendar feed query failed:', error.message);
    return new Response('Calendar unavailable', { status: 500 });
  }

  const origin = request.nextUrl.origin;
  const events: FeedEvent[] = ((data || []) as unknown as Row[]).map((a) => {
    const details = [
      a.customer?.contact_name && `Customer: ${a.customer.contact_name}`,
      a.customer?.phone && `Phone: ${a.customer.phone}`,
      a.customer?.email && `Email: ${a.customer.email}`,
      a.invoice && `Invoice ${a.invoice.invoice_number}, balance owing ${formatCurrency(a.invoice.balance_due)}`,
      a.notes && `Notes: ${a.notes}`,
    ].filter(Boolean);
    const link = a.invoice ? `${origin}/invoices/${a.invoice.id}` : `${origin}/calendar`;
    return {
      id: a.id,
      title: a.title,
      start: a.start_time,
      end: a.end_time,
      updated: a.updated_at,
      location: a.location,
      description: [...details, '', link].join('\n'),
      url: link,
    };
  });

  return new Response(buildIcs('Ideal Events Hire', events), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="ideal-events-hire.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
