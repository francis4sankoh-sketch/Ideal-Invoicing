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

type Customer = { contact_name: string; phone: string | null; email: string | null } | null;
type Appt = { id: string; start_time: string; end_time: string; location: string | null; status: string };

type InvoiceRow = {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  event_date: string;
  event_location: string | null;
  total: number;
  deposit_amount: number;
  amount_paid: number;
  balance_due: number;
  updated_at: string | null;
  customer: Customer;
  appointments: Appt[] | null;
};

type ApptRow = Appt & { title: string; notes: string | null; updated_at: string | null; customer: Customer };

function contactLines(c: Customer): (string | null)[] {
  return [
    c?.contact_name ? `Customer: ${c.contact_name}` : null,
    c?.phone ? `Phone: ${c.phone}` : null,
    c?.email ? `Email: ${c.email}` : null,
  ];
}

const joinLines = (lines: (string | null)[]) => lines.filter((l): l is string => l !== null).join('\n');

// Every booked invoice (sent, not draft or cancelled) with an event date becomes an event. Paid-deposit
// bookings show as confirmed; the rest are marked "Unpaid". If the booking has a timed entry on the app's
// Calendar it's used for the times, otherwise it's an all-day event. Calendar entries that aren't tied to
// an invoice are included as they are.
export async function GET(request: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!keyMatches(key.replace(/\.ics$/, ''))) {
    return new Response('Not found', { status: 404 });
  }

  const sinceDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createServiceRoleClient();
  const [invRes, apptRes] = await Promise.all([
    supabase
      .from('invoices')
      .select(
        'id, invoice_number, title, status, event_date, event_location, total, deposit_amount, amount_paid, balance_due, updated_at, customer:customers(contact_name, phone, email), appointments(id, start_time, end_time, location, status)'
      )
      .not('status', 'in', '(draft,cancelled)')
      .not('event_date', 'is', null)
      .gte('event_date', sinceDate.slice(0, 10))
      .order('event_date'),
    supabase
      .from('appointments')
      .select('id, title, start_time, end_time, location, status, notes, updated_at, customer:customers(contact_name, phone, email)')
      .is('invoice_id', null)
      .neq('status', 'cancelled')
      .gte('end_time', sinceDate),
  ]);
  if (invRes.error || apptRes.error) {
    console.error('Calendar feed query failed:', invRes.error?.message || apptRes.error?.message);
    return new Response('Calendar unavailable', { status: 500 });
  }

  const origin = request.nextUrl.origin;
  const events: FeedEvent[] = [];

  for (const inv of (invRes.data || []) as unknown as InvoiceRow[]) {
    const confirmed = inv.status === 'paid' || (inv.amount_paid > 0 && inv.amount_paid >= inv.deposit_amount);
    const appt = (inv.appointments || []).find((a) => a.status !== 'cancelled');
    const who = inv.customer?.contact_name;
    const name = `${who ? `${who}: ` : ''}${inv.title || 'Event'} (${inv.invoice_number})`;
    const link = `${origin}/invoices/${inv.id}`;
    const payment = confirmed
      ? `Deposit paid. Balance owing ${formatCurrency(inv.balance_due)} of ${formatCurrency(inv.total)}`
      : `Not paid yet. ${formatCurrency(inv.balance_due)} owing`;
    events.push({
      id: `inv-${inv.id}`,
      title: confirmed ? name : `Unpaid: ${name}`,
      start: appt ? appt.start_time : inv.event_date,
      end: appt ? appt.end_time : inv.event_date,
      allDay: !appt,
      tentative: !confirmed,
      updated: inv.updated_at,
      location: appt?.location || inv.event_location,
      description: joinLines([payment, ...contactLines(inv.customer), '', link]),
      url: link,
    });
  }

  for (const a of (apptRes.data || []) as unknown as ApptRow[]) {
    events.push({
      id: a.id,
      title: a.title,
      start: a.start_time,
      end: a.end_time,
      updated: a.updated_at,
      location: a.location,
      description: joinLines([...contactLines(a.customer), a.notes ? `Notes: ${a.notes}` : null, '', `${origin}/calendar`]),
      url: `${origin}/calendar`,
    });
  }

  return new Response(buildIcs('Ideal Events Hire', events), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="ideal-events-hire.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
