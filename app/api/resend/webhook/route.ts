import { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendTelegram } from '@/lib/notify/telegram';

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

  if (invoiceId) {
    const supabase = await createServiceRoleClient();
    let query = supabase
      .from('invoices')
      .update({ email_status: status, email_status_at: new Date().toISOString(), email_status_detail: detail })
      .eq('id', invoiceId);
    // A late "delayed" notice must not overwrite a final result.
    if (status === 'delayed') query = query.in('email_status', ['sent', 'delayed']);
    const { error } = await query;
    if (error) console.error('Could not update invoice email status:', error.message);
  }

  if (PROBLEMS.has(status)) {
    await sendTelegram(
      [
        `Email ${status}: ${event.data.subject || '(no subject)'}`,
        `To: ${(event.data.to || []).join(', ')}`,
        detail ? `Reason: ${detail.slice(0, 300)}` : null,
        invoiceId ? `Check the address and resend: ${process.env.NEXT_PUBLIC_APP_URL || 'https://ideal-invoicing-delta.vercel.app'}/invoices/${invoiceId}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    ).catch((err) => console.error('Bounce alert failed:', err));
  }
  return Response.json({ ok: true });
}
