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
import { getSignedInOrgId, loadBrand } from '@/lib/org/server';

// Dashboard only (login enforced by the proxy). Emails go out under the signed-in user's business.
export async function POST(request: NextRequest) {
  try {
    const me = await getSignedInOrgId();
    if (!me) return Response.json({ error: 'Not signed in' }, { status: 401 });
    if (!me.orgId) return Response.json({ error: 'Finish setting up your business first' }, { status: 403 });

    const body = await request.json();
    const { type, ...data } = body;
    const supabase = await createServiceRoleClient();

    // An invoice id from the browser must belong to this business before we record anything on it.
    let invoiceId: string | undefined;
    if (typeof data.invoiceId === 'string') {
      const { data: inv } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', data.invoiceId)
        .eq('organization_id', me.orgId)
        .maybeSingle();
      if (!inv) return Response.json({ error: 'Invoice not found' }, { status: 404 });
      invoiceId = inv.id;
    }

    const brand = await loadBrand(supabase, me.orgId);
    switch (type) {
      case 'quote_sent':
        await sendQuoteToCustomer(brand, data);
        break;
      case 'quote_accepted':
        await sendQuoteAcceptedNotification(brand, data);
        break;
      case 'quote_rejected':
        await sendQuoteRejectedNotification(brand, data);
        break;
      case 'invoice_sent':
        await sendInvoiceToCustomer(brand, { ...data, invoiceId });
        break;
      case 'payment_reminder':
        await sendPaymentReminder(brand, { ...data, invoiceId });
        break;
      case 'payment_confirmation':
        await sendPaymentConfirmation(brand, data);
        break;
      case 'new_message':
        await sendNewMessageNotification(brand, data);
        break;
      default:
        return Response.json({ error: 'Unknown email type' }, { status: 400 });
    }

    // Invoice emails start at "sent"; the Resend webhook moves them to delivered/bounced.
    if ((type === 'invoice_sent' || type === 'payment_reminder') && invoiceId) {
      const { error } = await supabase
        .from('invoices')
        .update({ email_status: 'sent', email_status_at: new Date().toISOString(), email_status_detail: null })
        .eq('id', invoiceId)
        .eq('organization_id', me.orgId);
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
