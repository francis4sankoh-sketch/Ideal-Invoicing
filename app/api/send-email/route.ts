import { NextRequest } from 'next/server';
import {
  sendQuoteToCustomer,
  sendQuoteAcceptedNotification,
  sendQuoteRejectedNotification,
  sendInvoiceToCustomer,
  sendPaymentReminder,
  sendPaymentConfirmation,
  sendNewMessageNotification,
} from '@/lib/resend/emails';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    switch (type) {
      case 'quote_sent':
        await sendQuoteToCustomer(data);
        break;
      case 'quote_accepted':
        await sendQuoteAcceptedNotification(data);
        break;
      case 'quote_rejected':
        await sendQuoteRejectedNotification(data);
        break;
      case 'invoice_sent':
        await sendInvoiceToCustomer(data);
        break;
      case 'payment_reminder':
        await sendPaymentReminder(data);
        break;
      case 'payment_confirmation':
        await sendPaymentConfirmation(data);
        break;
      case 'new_message':
        await sendNewMessageNotification(data);
        break;
      default:
        return Response.json({ error: 'Unknown email type' }, { status: 400 });
    }

    // Invoice emails start at "sent"; the Resend webhook moves them to delivered/bounced.
    if ((type === 'invoice_sent' || type === 'payment_reminder') && typeof data.invoiceId === 'string') {
      const supabase = await createServiceRoleClient();
      const { error } = await supabase
        .from('invoices')
        .update({ email_status: 'sent', email_status_at: new Date().toISOString(), email_status_detail: null })
        .eq('id', data.invoiceId);
      if (error) console.error('Could not record invoice email status:', error.message);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email API error:', error);
    const reason =
      error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Failed to send email';
    return Response.json({ error: reason }, { status: 500 });
  }
}
