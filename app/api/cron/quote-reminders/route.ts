import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendQuoteReminder } from '@/lib/resend/emails';
import { formatDateAU } from '@/lib/utils/format';

// Nudge config
const DAYS_BETWEEN = 3; // wait this many days after send / last nudge
const MAX_REMINDERS = 2; // stop after this many nudges

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ideal-invoicing-delta.vercel.app';

/**
 * Daily cron: email a gentle reminder for quotes that were sent but not yet
 * accepted/rejected, haven't been nudged in DAYS_BETWEEN days, and are under
 * the MAX_REMINDERS cap. Triggered by Vercel Cron (see vercel.json).
 */
export async function GET(request: NextRequest) {
  // Vercel Cron sends a Bearer token equal to CRON_SECRET
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - DAYS_BETWEEN * 24 * 60 * 60 * 1000);

  // Candidate quotes: status 'sent', under the reminder cap, sent long enough ago
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('id, quote_number, title, total, valid_until, sent_at, reminder_count, last_reminder_sent, last_viewed, customer:customers(contact_name, email, portal_token)')
    .eq('status', 'sent')
    .lt('reminder_count', MAX_REMINDERS);

  if (error) {
    console.error('Cron query failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ quote: string; sent: boolean; reason?: string }> = [];

  for (const q of quotes || []) {
    const customer = Array.isArray(q.customer) ? q.customer[0] : q.customer;
    if (!customer?.email || !customer?.portal_token) {
      results.push({ quote: q.quote_number, sent: false, reason: 'no customer email/token' });
      continue;
    }

    // Respect the gap since send and since last reminder
    const sentAt = q.sent_at ? new Date(q.sent_at) : null;
    if (sentAt && sentAt > cutoff) {
      results.push({ quote: q.quote_number, sent: false, reason: 'sent too recently' });
      continue;
    }
    if (q.last_reminder_sent) {
      const last = new Date(q.last_reminder_sent);
      if (last > cutoff) {
        results.push({ quote: q.quote_number, sent: false, reason: 'nudged too recently' });
        continue;
      }
    }

    const portalUrl = `${APP_URL}/portal/${customer.portal_token}?quote=${q.id}`;
    try {
      await sendQuoteReminder({
        customerEmail: customer.email,
        customerName: customer.contact_name || 'there',
        quoteNumber: q.quote_number,
        total: new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(q.total || 0),
        portalUrl,
        validUntil: q.valid_until ? formatDateAU(q.valid_until) : undefined,
      });

      await supabase
        .from('quotes')
        .update({
          reminder_count: (q.reminder_count || 0) + 1,
          last_reminder_sent: now.toISOString().split('T')[0],
        })
        .eq('id', q.id);

      results.push({ quote: q.quote_number, sent: true });
    } catch (err) {
      console.error(`Reminder failed for ${q.quote_number}:`, err);
      results.push({ quote: q.quote_number, sent: false, reason: 'email error' });
    }
  }

  const sentCount = results.filter((r) => r.sent).length;
  return Response.json({ ok: true, checked: quotes?.length || 0, sent: sentCount, results });
}
