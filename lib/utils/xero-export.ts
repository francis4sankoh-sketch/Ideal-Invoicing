/**
 * Build a CSV in Xero's "Sales Invoices" import format.
 *
 * Import in Xero: Business > Invoices > Import. Choose:
 *   - "Tax Exclusive" if your line prices exclude GST (default here), or
 *     "Tax Inclusive" if they include it.
 *   - Map "No" to "Don't import duplicates" if re-importing.
 *
 * One row per line item; rows sharing an InvoiceNumber become one invoice.
 * Reference: Xero sales invoice CSV template.
 */

import { Invoice, Customer, LineItem } from '@/types';

export type InvoiceForExport = Invoice & { customer: Customer | null };

// Sales account in Xero's default chart of accounts ("200 - Sales").
// Change here if your Xero uses a different revenue account code.
const DEFAULT_ACCOUNT_CODE = '200';

// Xero Australian tax types
const TAX_GST = 'GST on Income';
const TAX_FREE = 'GST Free Income';

const COLUMNS = [
  '*ContactName',
  'EmailAddress',
  'POAddressLine1',
  'POCity',
  'PORegion',
  'POPostalCode',
  'POCountry',
  '*InvoiceNumber',
  '*InvoiceDate',
  '*DueDate',
  'InventoryItemCode',
  '*Description',
  '*Quantity',
  '*UnitAmount',
  'Discount',
  '*AccountCode',
  '*TaxType',
  'Currency',
] as const;

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Xero prefers DD/MM/YYYY for AU; pass through ISO date (YYYY-MM-DD) -> DD/MM/YYYY
function toXeroDate(d: string | null): string {
  if (!d) return '';
  const iso = d.split('T')[0];
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, day] = parts;
  return `${day}/${m}/${y}`;
}

/**
 * Convert one invoice into one or more CSV rows (one per line item).
 * Invoice-level GST is applied per line via TaxType: if the invoice carries
 * GST we mark every line "GST on Income", otherwise "GST Free Income".
 */
function invoiceToRows(inv: InvoiceForExport): string[][] {
  const c = inv.customer;
  const contactName = c?.business_name || c?.contact_name || 'Unknown Contact';
  const taxType = (inv.gst_amount || 0) > 0 ? TAX_GST : TAX_FREE;
  const invoiceDate = toXeroDate(inv.issue_date || inv.created_at);
  const dueDate = toXeroDate(inv.due_date || inv.issue_date || inv.created_at);

  const lineItems: LineItem[] = Array.isArray(inv.line_items) ? inv.line_items : [];
  const rows: string[][] = [];

  const makeRow = (description: string, qty: number, unit: number): string[] => [
    contactName,
    c?.email || '',
    c?.address || '',
    c?.city || '',
    c?.state || '',
    c?.postcode || '',
    c?.address ? 'Australia' : '',
    inv.invoice_number,
    invoiceDate,
    dueDate,
    '', // InventoryItemCode
    description || 'Event hire',
    String(qty),
    unit.toFixed(2),
    '', // Discount (per-line; invoice-level discount handled below)
    DEFAULT_ACCOUNT_CODE,
    taxType,
    'AUD',
  ];

  if (lineItems.length === 0) {
    rows.push(makeRow(inv.title || 'Event hire', 1, inv.total || 0));
  } else {
    for (const li of lineItems) {
      rows.push(makeRow(li.description, li.quantity || 1, li.unit_price || 0));
    }
    // Represent an invoice-level discount as a negative line so the CSV total
    // matches the app's invoice total.
    if ((inv.discount_amount || 0) > 0) {
      rows.push(makeRow('Discount', 1, -(inv.discount_amount || 0)));
    }
  }

  return rows;
}

export function buildXeroInvoiceCsv(invoices: InvoiceForExport[]): string {
  const lines: string[] = [];
  lines.push(COLUMNS.join(','));
  for (const inv of invoices) {
    for (const row of invoiceToRows(inv)) {
      lines.push(row.map(csvEscape).join(','));
    }
  }
  return lines.join('\r\n');
}

/** Trigger a browser download of the given CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
