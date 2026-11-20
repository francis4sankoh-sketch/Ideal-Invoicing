import { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendTelegram } from '@/lib/notify/telegram';
import { APP_URL } from '@/lib/app-config';
import { getDefaultOrg } from '@/lib/org/server';

// Resend posts delivery events here. Public, so every request must carry a valid signature.
const STATUS: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.failed': 'failed',
  'email.complained': 'complained',
  'email.suppressed': 'suppressed',
};
const PROBLEMS = new Set(['bounced', 'failed', 'complained', 'suppressed']);

type EmailEvent = {
  type: string;
  data: {
    from?: string;
    to?: string[];
    subject?: string;
    tags?: Record<string, string> | Array<{ name: string; value: string }>;
    bounce?: { message?: string };
    failed?: { reason?: string };
  };
};

function invoiceIdFrom(tags: EmailEvent['data']['tags']): string | null {
  if (!tags) return null;
  const value = Array.isArray(tags) ? tags.find((t) => t.name === 'invoice_id')?.value : tags.invoice_id;
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const payload = await request.text();
  let event: EmailEvent;
  try {
    if (!secret) throw new Error('RESEND_WEBHOOK_SECRET not set');
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: {
        id: request.headers.get('svix-id') || '',
        timestamp: request.headers.get('svix-timestamp') || '',
        signature: request.headers.get('svix-signature') || '',
      },
      webhookSecret: secret,
    }) as unknown as EmailEvent;
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const status = STATUS[event.type];
  if (!status) return Response.json({ ok: true });

  const detail = event.data.bounce?.message || event.data.failed?.reason || null;
  const invoiceId = invoiceIdFrom(event.data.tags);

  // Bounce alerts go to the Telegram bot, which belongs to the original business. Other
  // businesses see the problem on the invoice itself. Emails not tied to an invoice are matched
  // to the original business by the address they were sent from.
  const supabase = await createServiceRoleClient();
  let alertOwner = false;
  if (!invoiceId && PROBLEMS.has(status)) {
    const fromAddress = event.data.from?.match(/<([^>]+)>/)?.[1] || event.data.from || '';
    const defaultFrom = (await getDefaultOrg(supabase))?.email_from;
    alertOwner = !!defaultFrom && fromAddress.trim().toLowerCase() === defaultFrom.toLowerCase();
  }
  if (invoiceId) {
    const { data: inv } = await supabase
      .from('invoices')
      .select('organizations(is_default)')
      .eq('id', invoiceId)
      .maybeSingle();
    const org = inv?.organizations as unknown as { is_default: boolean } | null;
    alertOwner = org?.is_default === true;
    let query = supabase
      .from('invoices')
      .update({ email_status: status, email_status_at: new Date().toISOString(), email_status_detail: detail })
      .eq('id', invoiceId);
    // A late "delayed" notice must not overwrite a final result.
    if (status === 'delayed') query = query.in('email_status', ['sent', 'delayed']);
    const { error } = await query;
    if (error) console.error('Could not update invoice email status:', error.message);
  }

  if (PROBLEMS.has(status) && alertOwner) {
    await sendTelegram(
      [
        `Email ${status}: ${event.data.subject || '(no subject)'}`,
        `To: ${(event.data.to || []).join(', ')}`,
        detail ? `Reason: ${detail.slice(0, 300)}` : null,
        invoiceId ? `Check the address and resend: ${APP_URL}/invoices/${invoiceId}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    ).catch((err) => console.error('Bounce alert failed:', err));
  }
  return Response.json({ ok: true });
}
