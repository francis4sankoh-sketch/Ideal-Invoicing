import { Resend } from 'resend';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM_EMAIL = 'Ideal Events Group <info@idealeventsgroup.com.au>';
const BUSINESS_EMAILS = ['francis4sankoh@gmail.com', 'info@idealeventsgroup.com.au'];
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

async function sendEmail(options: EmailOptions) {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Email send failed:', err);
    throw err;
  }
}

function emailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f5f5f5; color: #1a1a1a; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background-color: #800020; padding: 24px 32px; text-align: center; }
        .header h1 { color: #ffffff; font-family: Georgia, serif; font-size: 24px; margin: 0; }
        .header p { color: rgba(255,255,255,0.7); font-size: 10px; letter-spacing: 3px; text-transform: uppercase; margin: 4px 0 0; }
        .body { padding: 32px; }
        .footer { background-color: #fdf0ef; padding: 24px 32px; text-align: center; font-size: 12px; color: #555555; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #800020; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
        .btn:hover { background-color: #4a0012; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: 600; color: #555555; font-size: 12px; text-transform: uppercase; }
        .detail-value { font-size: 14px; color: #1a1a1a; }
        .highlight { background-color: #fdf0ef; padding: 16px; border-radius: 8px; border-left: 4px solid #800020; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Ideal</h1>
          <p>Events Group</p>
        </div>
        <div class="body">
          ${content}
        </div>
        <div class="footer">
          <p>Ideal Events Group &middot; Melbourne, Victoria</p>
          <p>info@idealeventsgroup.com.au &middot; idealeventsgroup.com.au</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendNewEnquiryNotification(enquiry: {
  name: string;
  email: string;
  event_type?: string | null;
  event_date?: string | null;
  event_location?: string | null;
  guest_count?: string | null;
  budget_range?: string | null;
  venue_access?: string | null;
  additional_notes?: string | null;
  selected_items?: Array<{ product_name: string; quantity: number }>;
}) {
  const itemsList = enquiry.selected_items?.map(i => `<li>${i.product_name} x ${i.quantity}</li>`).join('') || '<li>None specified</li>';
  const row = (label: string, value: string | null | undefined) =>
    value
      ? `<div class="detail-row"><span class="detail-label">${label}:</span> <span class="detail-value">${value}</span></div>`
      : '';

  return sendEmail({
    to: BUSINESS_EMAILS,
    subject: `New quote request from ${enquiry.name}`,
    html: emailWrapper(`
      <h2 style="color: #800020; font-family: Georgia, serif;">New Quote Request</h2>
      <div class="highlight">
        <p><strong>${enquiry.name}</strong> has submitted a quote request.</p>
      </div>
      <div style="margin-top: 16px;">
        ${row('Email', enquiry.email)}
        ${row('Event Type', enquiry.event_type)}
        ${row('Event Date', enquiry.event_date)}
        ${row('Event Location', enquiry.event_location)}
        ${row('Guest Count', enquiry.guest_count)}
        ${row('Budget', enquiry.budget_range)}
        ${row('Venue Access', enquiry.venue_access)}
        <div class="detail-row"><span class="detail-label">Items Requested:</span></div>
        <ul>${itemsList}</ul>
        ${enquiry.additional_notes ? `<div style="margin-top:12px;"><span class="detail-label">Customer Notes:</span><p style="font-size:14px;color:#1a1a1a;margin:6px 0 0;white-space:pre-wrap;">${enquiry.additional_notes}</p></div>` : ''}
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${APP_URL}/enquiries" class="btn">View in Ideal Invoicing</a>
      </div>
    `),
  });
}

export async function sendQuoteToCustomer(options: {
  customerEmail: string;
  customerName: string;
  quoteNumber: string;
  total: string;
  depositAmount: string;
  portalUrl: string;
  subject?: string;
  body?: string;
}) {
  return sendEmail({
    to: [options.customerEmail, ...BUSINESS_EMAILS],
    subject: options.subject || `Your quote from Ideal Events Group — ${options.quoteNumber}`,
    html: emailWrapper(
      options.body ||
      `
      <h2 style="color: #800020; font-family: Georgia, serif;">Your Quote is Ready</h2>
      <p style="font-size: 15px; line-height: 1.6;">Hi ${options.customerName},</p>
      <p style="font-size: 15px; line-height: 1.6;">Thank you so much for reaching out to us! We're excited about the opportunity to help bring your vision to life.</p>
      <p style="font-size: 15px; line-height: 1.6;">We've put together a personalised quote for your upcoming event. Please find the details below:</p>
      <div class="highlight" style="margin: 24px 0;">
        <div class="detail-row"><span class="detail-label">Quote Number:</span> <span class="detail-value">${options.quoteNumber}</span></div>
        <div class="detail-row"><span class="detail-label">Total:</span> <span class="detail-value">${options.total}</span></div>
        <div class="detail-row"><span class="detail-label">Deposit to Confirm:</span> <span class="detail-value">${options.depositAmount}</span></div>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">You can view the full breakdown of your quote, including all items and package details, by clicking the button below. From there you can also accept the quote, leave a message, or let us know if you'd like any changes.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${options.portalUrl}" class="btn">View Your Quote</a>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">If you have any questions at all, feel free to reply directly to this email or send us a message through the portal. We're always happy to help!</p>
      <p style="font-size: 15px; line-height: 1.6;">We look forward to making your event truly special.</p>
      <p style="font-size: 15px; line-height: 1.6; margin-top: 24px;">Warm regards,<br><strong>The Ideal Events Group Team</strong><br>
      <span style="font-size: 13px; color: #666;">Melbourne, Victoria</span><br>
      <span style="font-size: 13px; color: #666;">info@idealeventsgroup.com.au</span></p>
    `),
  });
}

export async function sendQuoteAcceptedNotification(options: {
  customerName: string;
  quoteNumber: string;
  total: string;
  depositAmount: string;
}) {
  return sendEmail({
    to: BUSINESS_EMAILS,
    subject: `${options.customerName} has accepted Quote ${options.quoteNumber}`,
    html: emailWrapper(`
      <h2 style="color: #22c55e; font-family: Georgia, serif;">Quote Accepted!</h2>
      <div class="highlight">
        <p><strong>${options.customerName}</strong> has accepted <strong>${options.quoteNumber}</strong>.</p>
      </div>
      <div style="margin-top: 16px;">
        <div class="detail-row"><span class="detail-label">Total:</span> <span class="detail-value">${options.total}</span></div>
        <div class="detail-row"><span class="detail-label">Deposit Required:</span> <span class="detail-value">${options.depositAmount}</span></div>
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${APP_URL}/quotes" class="btn">View Quote</a>
      </div>
    `),
  });
}

export async function sendQuoteRejectedNotification(options: {
  customerName: string;
  quoteNumber: string;
  reason?: string;
}) {
  return sendEmail({
    to: BUSINESS_EMAILS,
    subject: `${options.customerName} has rejected Quote ${options.quoteNumber}`,
    html: emailWrapper(`
      <h2 style="color: #ef4444; font-family: Georgia, serif;">Quote Rejected</h2>
      <div class="highlight">
        <p><strong>${options.customerName}</strong> has rejected <strong>${options.quoteNumber}</strong>.</p>
        ${options.reason ? `<p><strong>Reason:</strong> ${options.reason}</p>` : ''}
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${APP_URL}/quotes" class="btn">View Quote</a>
      </div>
    `),
  });
}

export async function sendInvoiceToCustomer(options: {
  customerEmail: string;
  customerName: string;
  invoiceNumber: string;
  total: string;
  balanceDue: string;
  dueDate: string;
  bankDetails: string;
  portalUrl: string;
  subject?: string;
  body?: string;
  pdfBuffer?: Buffer;
}) {
  return sendEmail({
    to: [options.customerEmail, ...BUSINESS_EMAILS],
    subject: options.subject || `Invoice ${options.invoiceNumber} from Ideal Events Group`,
    html: emailWrapper(
      options.body ||
      `
      <h2 style="color: #800020; font-family: Georgia, serif;">Your Invoice from Ideal Events Group</h2>
      <p style="font-size: 15px; line-height: 1.6;">Hi ${options.customerName},</p>
      <p style="font-size: 15px; line-height: 1.6;">Thank you for choosing Ideal Events Group! We truly appreciate your business and can't wait to help make your event unforgettable.</p>
      <p style="font-size: 15px; line-height: 1.6;">Please find your invoice details below:</p>
      <div class="highlight" style="margin: 24px 0;">
        <div class="detail-row"><span class="detail-label">Invoice Number:</span> <span class="detail-value">${options.invoiceNumber}</span></div>
        <div class="detail-row"><span class="detail-label">Total Amount:</span> <span class="detail-value">${options.total}</span></div>
        <div class="detail-row"><span class="detail-label">Balance Due:</span> <span class="detail-value" style="font-weight: 700; color: #800020;">${options.balanceDue}</span></div>
        <div class="detail-row"><span class="detail-label">Payment Due By:</span> <span class="detail-value">${options.dueDate}</span></div>
      </div>
      <h3 style="margin-top: 24px; color: #800020; font-family: Georgia, serif;">Payment Details</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #555;">Please use the bank details below to make your payment. Don't forget to include the invoice number as your payment reference so we can match it to your booking.</p>
      ${options.bankDetails}
      <p style="font-size: 15px; line-height: 1.6; margin-top: 20px;">You can view the full invoice, including a complete breakdown of all items, by clicking the button below:</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${options.portalUrl}" class="btn">View Your Invoice</a>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">If you have any questions about this invoice or your upcoming event, please don't hesitate to reply to this email. We're here to help!</p>
      <p style="font-size: 15px; line-height: 1.6; margin-top: 24px;">Warm regards,<br><strong>The Ideal Events Group Team</strong><br>
      <span style="font-size: 13px; color: #666;">Melbourne, Victoria</span><br>
      <span style="font-size: 13px; color: #666;">info@idealeventsgroup.com.au</span></p>
    `),
    attachments: options.pdfBuffer
      ? [{ filename: `${options.invoiceNumber}.pdf`, content: options.pdfBuffer }]
      : undefined,
  });
}

export async function sendPaymentReminder(options: {
  customerEmail: string;
  customerName: string;
  invoiceNumber: string;
  balanceDue: string;
  dueDate: string;
  bankDetails: string;
  portalUrl: string;
}) {
  return sendEmail({
    to: options.customerEmail,
    subject: `Friendly reminder — Invoice ${options.invoiceNumber} is due ${options.dueDate}`,
    html: emailWrapper(`
      <h2 style="color: #800020; font-family: Georgia, serif;">Friendly Payment Reminder</h2>
      <p style="font-size: 15px; line-height: 1.6;">Hi ${options.customerName},</p>
      <p style="font-size: 15px; line-height: 1.6;">We hope you're doing well! Just a gentle reminder that payment for the following invoice is coming up:</p>
      <div class="highlight" style="margin: 24px 0;">
        <div class="detail-row"><span class="detail-label">Invoice Number:</span> <span class="detail-value">${options.invoiceNumber}</span></div>
        <div class="detail-row"><span class="detail-label">Balance Due:</span> <span class="detail-value" style="font-weight: 700; color: #800020;">${options.balanceDue}</span></div>
        <div class="detail-row"><span class="detail-label">Payment Due By:</span> <span class="detail-value">${options.dueDate}</span></div>
      </div>
      <h3 style="margin-top: 24px; color: #800020; font-family: Georgia, serif;">Payment Details</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #555;">Please use the details below and include the invoice number as your payment reference.</p>
      ${options.bankDetails}
      <div style="margin: 28px 0; text-align: center;">
        <a href="${options.portalUrl}" class="btn">View Your Invoice</a>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">If you've already made the payment, please disregard this reminder — thank you! And if you have any questions, we're just an email away.</p>
      <p style="font-size: 15px; line-height: 1.6; margin-top: 24px;">Warm regards,<br><strong>The Ideal Events Group Team</strong><br>
      <span style="font-size: 13px; color: #666;">Melbourne, Victoria</span><br>
      <span style="font-size: 13px; color: #666;">info@idealeventsgroup.com.au</span></p>
    `),
  });
}

export async function sendPaymentConfirmation(options: {
  customerEmail: string;
  customerName: string;
  invoiceNumber: string;
  amountPaid: string;
  remainingBalance: string;
}) {
  return sendEmail({
    to: [options.customerEmail, ...BUSINESS_EMAILS],
    subject: `Payment confirmed — Thank you, ${options.customerName}!`,
    html: emailWrapper(`
      <h2 style="color: #22c55e; font-family: Georgia, serif;">Payment Received — Thank You!</h2>
      <p style="font-size: 15px; line-height: 1.6;">Hi ${options.customerName},</p>
      <p style="font-size: 15px; line-height: 1.6;">Great news — we've received your payment! Thank you so much. Here's a summary for your records:</p>
      <div class="highlight" style="margin: 24px 0;">
        <div class="detail-row"><span class="detail-label">Invoice Number:</span> <span class="detail-value">${options.invoiceNumber}</span></div>
        <div class="detail-row"><span class="detail-label">Amount Received:</span> <span class="detail-value" style="font-weight: 700; color: #22c55e;">${options.amountPaid}</span></div>
        <div class="detail-row"><span class="detail-label">Remaining Balance:</span> <span class="detail-value">${options.remainingBalance}</span></div>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">${parseFloat(options.remainingBalance.replace(/[^0-9.]/g, '')) > 0 ? 'The remaining balance can be paid at any time before your event date.' : 'Your invoice is now fully paid — you\'re all set!'}</p>
      <p style="font-size: 15px; line-height: 1.6;">We're looking forward to your event and making it something truly special. If there's anything else you need, don't hesitate to reach out.</p>
      <p style="font-size: 15px; line-height: 1.6; margin-top: 24px;">Warm regards,<br><strong>The Ideal Events Group Team</strong><br>
      <span style="font-size: 13px; color: #666;">Melbourne, Victoria</span><br>
      <span style="font-size: 13px; color: #666;">info@idealeventsgroup.com.au</span></p>
    `),
  });
}

export async function sendNewMessageNotification(options: {
  customerName: string;
  quoteNumber: string;
  messagePreview: string;
}) {
  return sendEmail({
    to: BUSINESS_EMAILS,
    subject: `New message from ${options.customerName} on Quote ${options.quoteNumber}`,
    html: emailWrapper(`
      <h2 style="color: #800020; font-family: Georgia, serif;">New Customer Message</h2>
      <div class="highlight">
        <p><strong>${options.customerName}</strong> sent a message on <strong>${options.quoteNumber}</strong>:</p>
        <p style="font-style: italic; margin-top: 8px;">"${options.messagePreview}"</p>
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${APP_URL}/quotes" class="btn">Reply in App</a>
      </div>
    `),
  });
}
