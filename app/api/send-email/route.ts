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

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email API error:', error);
    return Response.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
