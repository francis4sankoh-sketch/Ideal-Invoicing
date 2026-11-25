import { Resend } from 'resend';
import { APP_NAME, APP_URL } from '@/lib/app-config';
import type { Brand } from '@/lib/org/server';
import { brandPalette } from '@/lib/utils/brand-colors';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

// Businesses without their own verified sending domain send from this shared address, with
// replies going to the business's own inbox. Ideal sends from its own domain (organizations.email_from).
const PLATFORM_FROM = process.env.PLATFORM_FROM_EMAIL || '';

// The domain the email health check watches.
export const FROM_EMAIL = PLATFORM_FROM || 'info@idealeventshire.com.au';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
  // Lets the Resend webhook match delivery events back to an invoice (see app/api/resend/webhook)
  invoiceId?: string;
}

function senderFor(brand: Brand): string {
  const address = brand.from || PLATFORM_FROM;
  if (!address) {
    throw new Error("Email sending isn't set up for this business yet. Please contact support.");
  }
  const name = brand.name.replace(/["<>\r\n\\]/g, '').trim() || APP_NAME;
  return `"${name}" <${address}>`;
}

// The business's own inbox, for copies of what it sends and for alerts.
function businessInbox(brand: Brand): string[] {
  return brand.email ? [brand.email] : [];
}

async function sendEmail(brand: Brand, options: EmailOptions) {
  const to = (Array.isArray(options.to) ? options.to : [options.to]).filter(Boolean);
  if (to.length === 0) throw new Error('No email address to send to. Add one under Settings.');
  try {
    const { data, error } = await getResend().emails.send({
      from: senderFor(brand),
      replyTo: brand.email || undefined,
      to: [...new Set(to)],
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
      tags: options.invoiceId && /^[\w-]+$/.test(options.invoiceId) ? [{ name: 'invoice_id', value: options.invoiceId }] : undefined,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Email send failed:', err);
    throw err;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function websiteLabel(url: string | null): string | null {
  return url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : null;
}

function emailWrapper(brand: Brand, content: string): string {
  const name = escapeHtml(brand.name);
  const pale = brandPalette(brand.color).pale;
  const line1 = [name, brand.location && escapeHtml(brand.location)].filter(Boolean).join(' &middot; ');
  const line2 = [brand.email && escapeHtml(brand.email), escapeHtml(websiteLabel(brand.website) || '')]
    .filter(Boolean)
    .join(' &middot; ');
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f5f5f5; color: #1a1a1a; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background-color: ${brand.color}; padding: 24px 32px; text-align: center; }
        .header h1 { color: #ffffff; font-family: Georgia, serif; font-size: 24px; margin: 0; }
        .body { padding: 32px; }
        .footer { background-color: ${pale}; padding: 24px 32px; text-align: center; font-size: 12px; color: #555555; }
        .btn { display: inline-block; padding: 12px 24px; background-color: ${brand.color}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: 600; color: #555555; font-size: 12px; text-transform: uppercase; }
        .detail-value { font-size: 14px; color: #1a1a1a; }
        .highlight { background-color: ${pale}; padding: 16px; border-radius: 8px; border-left: 4px solid ${brand.color}; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${name}</h1>
        </div>
        <div class="body">
          ${content}
        </div>
        <div class="footer">
          <p>${line1}</p>
          ${line2 ? `<p>${line2}</p>` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
}

function heading(brand: Brand, text: string, color = brand.color): string {
  return `<h2 style="color: ${color}; font-family: Georgia, serif;">${text}</h2>`;
}

function signOff(brand: Brand, withContact = true): string {
  const extra = withContact
    ? [brand.location, brand.email]
        .filter(Boolean)
        .map((v) => `<br>\n      <span style="font-size: 13px; color: #666;">${escapeHtml(v!)}</span>`)
        .join('')
    : '';
  return `<p style="font-size: 15px; line-height: 1.6; margin-top: 24px;">Warm regards,<br><strong>The ${escapeHtml(brand.name)} Team</strong>${extra}</p>`;
}

export async function sendNewEnquiryNotification(
  brand: Brand,
  enquiry: {
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
  }
) {
  const itemsList =
    enquiry.selected_items?.map((i) => `<li>${escapeHtml(i.product_name)} x ${i.quantity}</li>`).join('') ||
    '<li>None specified</li>';
  const row = (label: string, value: string | null | undefined) =>
    value
      ? `<div class="detail-row"><span class="detail-label">${label}:</span> <span class="detail-value">${escapeHtml(value)}</span></div>`
      : '';

  return sendEmail(brand, {
    to: businessInbox(brand),
    subject: `New quote request from ${enquiry.name}`,
    html: emailWrapper(brand, `
      ${heading(brand, 'New Quote Request')}
      <div class="highlight">
        <p><strong>${escapeHtml(enquiry.name)}</strong> has submitted a quote request.</p>
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
        ${enquiry.additional_notes ? `<div style="margin-top:12px;"><span class="detail-label">Customer Notes:</span><p style="font-size:14px;color:#1a1a1a;margin:6px 0 0;white-space:pre-wrap;">${escapeHtml(enquiry.additional_notes)}</p></div>` : ''}
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${APP_URL}/enquiries" class="btn">View in ${escapeHtml(APP_NAME)}</a>
      </div>
    `),
  });
}

export async function sendQuoteToCustomer(
  brand: Brand,
  options: {
    customerEmail: string;
    customerName: string;
    quoteNumber: string;
    total: string;
    depositAmount: string;
    portalUrl: string;
    subject?: string;
    body?: string;
  }
) {
  return sendEmail(brand, {
    to: [options.customerEmail, ...businessInbox(brand)],
    subject: options.subject || `Your quote from ${brand.name}: ${options.quoteNumber}`,
    html: emailWrapper(
      brand,
      options.body ||
        `
      ${heading(brand, 'Your Quote is Ready')}
      <p style="font-size: 15px; line-height: 1.6;">Hi ${escapeHtml(options.customerName)},</p>
      <p style="font-size: 15px; line-height: 1.6;">Thank you so much for reaching out to us! We're excited about the opportunity to help bring your vision to life.</p>
      <p style="font-size: 15px; line-height: 1.6;">We've put together a personalised quote for your upcoming event. Please find the details below:</p>
      <div class="highlight" style="margin: 24px 0;">
        <div class="detail-row"><span class="detail-label">Quote Number:</span> <span class="detail-value">${escapeHtml(options.quoteNumber)}</span></div>
        <div class="detail-row"><span class="detail-label">Total:</span> <span class="detail-value">${escapeHtml(options.total)}</span></div>
        <div class="detail-row"><span class="detail-label">Deposit to Confirm:</span> <span class="detail-value">${escapeHtml(options.depositAmount)}</span></div>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">You can view the full breakdown of your quote, including all items and package details, by clicking the button below. From there you can also accept the quote, leave a message, or let us know if you'd like any changes.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${options.portalUrl}" class="btn">View Your Quote</a>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">If you have any questions at all, feel free to reply directly to this email or send us a message through the portal. We're always happy to help!</p>
      <p style="font-size: 15px; line-height: 1.6;">We look forward to making your event truly special.</p>
      ${signOff(brand)}
    `
    ),
  });
}

export async function sendQuoteReminder(
  brand: Brand,
  options: {
    customerEmail: string;
    customerName: string;
    quoteNumber: string;
    total: string;
    portalUrl: string;
    validUntil?: string;
  }
) {
  return sendEmail(brand, {
    to: options.customerEmail,
    subject: `Just checking in on your quote ${options.quoteNumber}`,
    html: emailWrapper(brand, `
      ${heading(brand, 'Still thinking it over?')}
      <p style="font-size: 15px; line-height: 1.6;">Hi ${escapeHtml(options.customerName)},</p>
      <p style="font-size: 15px; line-height: 1.6;">We wanted to gently follow up on the quote we sent through. We'd love to be part of your event and we're holding your items, but spots do book up.</p>
      <div class="highlight" style="margin: 24px 0;">
        <div class="detail-row"><span class="detail-label">Quote Number:</span> <span class="detail-value">${escapeHtml(options.quoteNumber)}</span></div>
        <div class="detail-row"><span class="detail-label">Total:</span> <span class="detail-value">${escapeHtml(options.total)}</span></div>
        ${options.validUntil ? `<div class="detail-row"><span class="detail-label">Valid Until:</span> <span class="detail-value">${escapeHtml(options.validUntil)}</span></div>` : ''}
      </div>
      <p style="font-size: 15px; line-height: 1.6;">You can review everything, accept, or send us a message right from the link below:</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${options.portalUrl}" class="btn">View Your Quote</a>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">If now isn't the right time or your plans have changed, just reply and let us know. No pressure at all.</p>
      ${signOff(brand)}
    `),
  });
}

export async function sendQuoteAcceptedNotification(
  brand: Brand,
  options: {
    customerName: string;
    quoteNumber: string;
    total: string;
    depositAmount: string;
  }
) {
  return sendEmail(brand, {
    to: businessInbox(brand),
    subject: `${options.customerName} has accepted Quote ${options.quoteNumber}`,
    html: emailWrapper(brand, `
      ${heading(brand, 'Quote Accepted!', '#22c55e')}
      <div class="highlight">
        <p><strong>${escapeHtml(options.customerName)}</strong> has accepted <strong>${escapeHtml(options.quoteNumber)}</strong>.</p>
      </div>
      <div style="margin-top: 16px;">
        <div class="detail-row"><span class="detail-label">Total:</span> <span class="detail-value">${escapeHtml(options.total)}</span></div>
        <div class="detail-row"><span class="detail-label">Deposit Required:</span> <span class="detail-value">${escapeHtml(options.depositAmount)}</span></div>
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${APP_URL}/quotes" class="btn">View Quote</a>
      </div>
    `),
  });
}

export async function sendQuoteRejectedNotification(
  brand: Brand,
  options: {
    customerName: string;
    quoteNumber: string;
    reason?: string;
  }
) {
  return sendEmail(brand, {
    to: businessInbox(brand),
    subject: `${options.customerName} has rejected Quote ${options.quoteNumber}`,
    html: emailWrapper(brand, `
      ${heading(brand, 'Quote Rejected', '#ef4444')}
      <div class="highlight">
        <p><strong>${escapeHtml(options.customerName)}</strong> has rejected <strong>${escapeHtml(options.quoteNumber)}</strong>.</p>
        ${options.reason ? `<p><strong>Reason:</strong> ${escapeHtml(options.reason)}</p>` : ''}
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${APP_URL}/quotes" class="btn">View Quote</a>
      </div>
    `),
  });
}

export async function sendInvoiceToCustomer(
  brand: Brand,
  options: {
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
    invoiceId?: string;
  }
) {
  const name = escapeHtml(brand.name);
  return sendEmail(brand, {
    invoiceId: options.invoiceId,
    to: [options.customerEmail, ...businessInbox(brand)],
    subject: options.subject || `Invoice ${options.invoiceNumber} from ${brand.name}`,
    html: emailWrapper(
      brand,
      options.body ||
        `
      ${heading(brand, `Your Invoice from ${name}`)}
      <p style="font-size: 15px; line-height: 1.6;">Hi ${escapeHtml(options.customerName)},</p>
      <p style="font-size: 15px; line-height: 1.6;">Thank you for choosing ${name}! We truly appreciate your business and can't wait to help make your event unforgettable.</p>
      <p style="font-size: 15px; line-height: 1.6;">Please find your invoice details below:</p>
      <div class="highlight" style="margin: 24px 0;">
        <div class="detail-row"><span class="detail-label">Invoice Number:</span> <span class="detail-value">${escapeHtml(options.invoiceNumber)}</span></div>
        <div class="detail-row"><span class="detail-label">Total Amount:</span> <span class="detail-value">${escapeHtml(options.total)}</span></div>
        <div class="detail-row"><span class="detail-label">Balance Due:</span> <span class="detail-value" style="font-weight: 700; color: ${brand.color};">${escapeHtml(options.balanceDue)}</span></div>
        <div class="detail-row"><span class="detail-label">Payment Due By:</span> <span class="detail-value">${escapeHtml(options.dueDate)}</span></div>
      </div>
      <h3 style="margin-top: 24px; color: ${brand.color}; font-family: Georgia, serif;">Payment Details</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #555;">Please use the bank details below to make your payment. Don't forget to include the invoice number as your payment reference so we can match it to your booking.</p>
      ${options.bankDetails}
      <p style="font-size: 15px; line-height: 1.6; margin-top: 20px;">Please open your invoice using the button below. You'll see the full list of items and our hire Terms and Conditions. Once you've read them, tick the box and press <strong>Accept Invoice</strong> to confirm your booking. You can also download a PDF copy from the same page.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${options.portalUrl}" class="btn">View &amp; Accept Your Invoice</a>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">If you have any questions about this invoice or your upcoming event, please don't hesitate to reply to this email. We're here to help!</p>
      ${signOff(brand)}
    `
    ),
    attachments: options.pdfBuffer
      ? [{ filename: `${options.invoiceNumber}.pdf`, content: options.pdfBuffer }]
      : undefined,
  });
}

export async function sendInvoiceAcceptedNotification(
  brand: Brand,
  options: {
    customerName: string;
    acceptedName: string;
    invoiceNumber: string;
    total: string;
    acceptedAt: string;
    invoiceId: string;
  }
) {
  return sendEmail(brand, {
    to: businessInbox(brand),
    subject: `${options.customerName} has accepted Invoice ${options.invoiceNumber}`,
    html: emailWrapper(brand, `
      ${heading(brand, 'Invoice Accepted', '#22c55e')}
      <div class="highlight">
        <p><strong>${escapeHtml(options.customerName)}</strong> has accepted <strong>${escapeHtml(options.invoiceNumber)}</strong> and agreed to your Terms and Conditions.</p>
      </div>
      <div style="margin-top: 16px;">
        <div class="detail-row"><span class="detail-label">Signed as:</span> <span class="detail-value">${escapeHtml(options.acceptedName)}</span></div>
        <div class="detail-row"><span class="detail-label">Accepted:</span> <span class="detail-value">${escapeHtml(options.acceptedAt)}</span></div>
        <div class="detail-row"><span class="detail-label">Total:</span> <span class="detail-value">${escapeHtml(options.total)}</span></div>
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${APP_URL}/invoices/${options.invoiceId}" class="btn">View Invoice</a>
      </div>
    `),
  });
}

export async function sendPaymentReminder(
  brand: Brand,
  options: {
    customerEmail: string;
    customerName: string;
    invoiceNumber: string;
    balanceDue: string;
    dueDate: string;
    bankDetails: string;
    portalUrl: string;
    invoiceId?: string;
  }
) {
  return sendEmail(brand, {
    invoiceId: options.invoiceId,
    to: options.customerEmail,
    subject: `Friendly reminder: Invoice ${options.invoiceNumber} is due ${options.dueDate}`,
    html: emailWrapper(brand, `
      ${heading(brand, 'Friendly Payment Reminder')}
      <p style="font-size: 15px; line-height: 1.6;">Hi ${escapeHtml(options.customerName)},</p>
      <p style="font-size: 15px; line-height: 1.6;">We hope you're doing well! Just a gentle reminder that payment for the following invoice is coming up:</p>
      <div class="highlight" style="margin: 24px 0;">
        <div class="detail-row"><span class="detail-label">Invoice Number:</span> <span class="detail-value">${escapeHtml(options.invoiceNumber)}</span></div>
        <div class="detail-row"><span class="detail-label">Balance Due:</span> <span class="detail-value" style="font-weight: 700; color: ${brand.color};">${escapeHtml(options.balanceDue)}</span></div>
        <div class="detail-row"><span class="detail-label">Payment Due By:</span> <span class="detail-value">${escapeHtml(options.dueDate)}</span></div>
      </div>
      <h3 style="margin-top: 24px; color: ${brand.color}; font-family: Georgia, serif;">Payment Details</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #555;">Please use the details below and include the invoice number as your payment reference.</p>
      ${options.bankDetails}
      <div style="margin: 28px 0; text-align: center;">
        <a href="${options.portalUrl}" class="btn">View Your Invoice</a>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">If you've already made the payment, please disregard this reminder. Thank you! And if you have any questions, we're just an email away.</p>
      ${signOff(brand)}
    `),
  });
}

export async function sendPaymentConfirmation(
  brand: Brand,
  options: {
    customerEmail: string;
    customerName: string;
    invoiceNumber: string;
    amountPaid: string;
    remainingBalance: string;
  }
) {
  return sendEmail(brand, {
    to: [options.customerEmail, ...businessInbox(brand)],
    subject: `Payment confirmed. Thank you, ${options.customerName}!`,
    html: emailWrapper(brand, `
      ${heading(brand, 'Payment Received. Thank You!', '#22c55e')}
      <p style="font-size: 15px; line-height: 1.6;">Hi ${escapeHtml(options.customerName)},</p>
      <p style="font-size: 15px; line-height: 1.6;">Great news: we've received your payment! Thank you so much. Here's a summary for your records:</p>
      <div class="highlight" style="margin: 24px 0;">
        <div class="detail-row"><span class="detail-label">Invoice Number:</span> <span class="detail-value">${escapeHtml(options.invoiceNumber)}</span></div>
        <div class="detail-row"><span class="detail-label">Amount Received:</span> <span class="detail-value" style="font-weight: 700; color: #22c55e;">${escapeHtml(options.amountPaid)}</span></div>
        <div class="detail-row"><span class="detail-label">Remaining Balance:</span> <span class="detail-value">${escapeHtml(options.remainingBalance)}</span></div>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">${parseFloat(options.remainingBalance.replace(/[^0-9.]/g, '')) > 0 ? 'The remaining balance can be paid at any time before your event date.' : "Your invoice is now fully paid. You're all set!"}</p>
      <p style="font-size: 15px; line-height: 1.6;">We're looking forward to your event and making it something truly special. If there's anything else you need, don't hesitate to reach out.</p>
      ${signOff(brand)}
    `),
  });
}

export async function sendNewMessageNotification(
  brand: Brand,
  options: {
    customerName: string;
    documentLabel?: string;
    quoteNumber?: string;
    messagePreview: string;
    appPath?: string;
  }
) {
  const label = options.documentLabel || `Quote ${options.quoteNumber}`;
  return sendEmail(brand, {
    to: businessInbox(brand),
    subject: `New message from ${options.customerName} on ${label}`,
    html: emailWrapper(brand, `
      ${heading(brand, 'New Customer Message')}
      <div class="highlight">
        <p><strong>${escapeHtml(options.customerName)}</strong> sent a message on <strong>${escapeHtml(label)}</strong>:</p>
        <p style="font-style: italic; margin-top: 8px;">"${escapeHtml(options.messagePreview)}"</p>
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${APP_URL}${options.appPath || '/quotes'}" class="btn">Reply in App</a>
      </div>
    `),
  });
}

export async function sendReplyToCustomer(
  brand: Brand,
  options: {
    customerEmail: string;
    customerName: string;
    documentLabel: string;
    message: string;
    portalUrl: string;
  }
) {
  return sendEmail(brand, {
    to: options.customerEmail,
    subject: `We've replied about your ${options.documentLabel}`,
    html: emailWrapper(brand, `
      ${heading(brand, 'You have a reply')}
      <p style="font-size: 15px; line-height: 1.6;">Hi ${escapeHtml(options.customerName)},</p>
      <p style="font-size: 15px; line-height: 1.6;">We've replied to your message about ${escapeHtml(options.documentLabel)}:</p>
      <div class="highlight" style="margin: 20px 0; white-space: pre-wrap; font-size: 15px; line-height: 1.6;">${escapeHtml(options.message)}</div>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${options.portalUrl}" class="btn">View and reply</a>
      </div>
      ${signOff(brand, false)}
    `),
  });
}

export async function sendReviewRequest(
  brand: Brand,
  options: { customerEmail: string; subject: string; message: string; reviewUrl: string }
) {
  return sendEmail(brand, {
    to: options.customerEmail,
    subject: options.subject,
    html: emailWrapper(brand, `
      <div style="white-space: pre-wrap; font-size: 15px; line-height: 1.6;">${escapeHtml(options.message)}</div>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${escapeHtml(options.reviewUrl)}" class="btn">Leave a Google Review</a>
      </div>
      ${signOff(brand)}
    `),
  });
}

// Comes from the app itself, not from a business.
export async function sendPasswordReset(options: { to: string; from: string | null; resetUrl: string }) {
  const brand: Brand = {
    orgId: '',
    isDefault: false,
    name: APP_NAME,
    email: null,
    phone: null,
    website: null,
    location: null,
    color: '#800020',
    from: PLATFORM_FROM || options.from,
  };
  return sendEmail(brand, {
    to: options.to,
    subject: `Reset your ${APP_NAME} password`,
    html: emailWrapper(brand, `
      ${heading(brand, 'Reset your password')}
      <p style="font-size: 15px; line-height: 1.6;">Someone asked to reset the password for your ${escapeHtml(APP_NAME)} account. If it was you, press the button to choose a new one.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${escapeHtml(options.resetUrl)}" class="btn">Set a New Password</a>
      </div>
      <p style="font-size: 13px; line-height: 1.6; color: #666;">The link works once and expires soon. If you didn't ask for this, ignore this email and your password stays the same.</p>
    `),
  });
}

export async function sendBackupEmail(
  brand: Brand,
  options: {
    takenAt: string;
    counts: Record<string, number>;
    filename: string;
    content: Buffer;
  }
) {
  const rows = Object.entries(options.counts)
    .map(([table, n]) => `<div class="detail-row"><span class="detail-label">${table.replace(/_/g, ' ')}:</span> <span class="detail-value">${n}</span></div>`)
    .join('');
  return sendEmail(brand, {
    to: businessInbox(brand),
    subject: `Weekly backup of ${brand.name} from ${APP_NAME} (${options.takenAt.slice(0, 10)})`,
    html: emailWrapper(brand, `
      ${heading(brand, 'Weekly data backup')}
      <p style="font-size: 15px; line-height: 1.6;">Attached is a full copy of your business's data in ${escapeHtml(APP_NAME)}, taken ${options.takenAt.slice(0, 16).replace('T', ' ')} UTC. Keep this email: if anything is ever lost, the data can be restored from it.</p>
      <div class="highlight" style="margin: 20px 0;">${rows}</div>
      <p style="font-size: 13px; color: #666;">It contains customer details and bank details, so don't forward it.</p>
    `),
    attachments: [{ filename: options.filename, content: options.content }],
  });
}
