import type { Invoice, LineItem } from '@/types';

export function recalculateTotals(
  items: LineItem[],
  discountType: string | null,
  discountValue: number,
  includeGst: boolean,
  depositPct: number
) {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  let discountAmount = 0;
  if (discountType === 'percentage') discountAmount = subtotal * (discountValue / 100);
  else if (discountType === 'fixed') discountAmount = discountValue;
  const afterDiscount = subtotal - discountAmount;
  const gstAmount = includeGst ? afterDiscount * 0.1 : 0;
  const total = afterDiscount + gstAmount;
  const depositAmount = total * (depositPct / 100);
  return { subtotal, discount_amount: discountAmount, gst_amount: gstAmount, total, deposit_amount: depositAmount };
}

// Invoices made before discounts and GST had their own columns only stored the
// resulting amounts. Rebuild the inputs so recalculating doesn't drop them.
export function normalizeForEditing(inv: Invoice): Invoice {
  const out: Invoice = { ...inv, line_items: inv.line_items || [], discount_value: inv.discount_value || 0 };
  if (!out.discount_type && out.discount_amount > 0) {
    out.discount_type = 'fixed';
    out.discount_value = out.discount_amount;
  }
  if (!out.include_gst && out.gst_amount > 0) out.include_gst = true;
  return out;
}

export function totalsMismatch(inv: Invoice, calcs: { total: number; deposit_amount: number }): boolean {
  return Math.abs(calcs.total - inv.total) > 0.01 || Math.abs(calcs.deposit_amount - inv.deposit_amount) > 0.01;
}

export function mismatchSummary(
  inv: Invoice,
  calcs: { total: number; deposit_amount: number },
  money: (n: number) => string
): string {
  const parts: string[] = [];
  if (Math.abs(calcs.total - inv.total) > 0.01) {
    parts.push(`the saved total is ${money(inv.total)} but the line items add up to ${money(calcs.total)}`);
  }
  if (Math.abs(calcs.deposit_amount - inv.deposit_amount) > 0.01) {
    parts.push(`the saved deposit is ${money(inv.deposit_amount)} but ${inv.deposit_percentage}% of the total is ${money(calcs.deposit_amount)}`);
  }
  return parts.join(', and ');
}

type PaymentState = 'unpaid' | 'partially_paid' | 'paid';

// An edit never touches the payments recorded, so the amount paid stays as stored and only the
// balance follows the new total. The status only changes when the invoice moves between unpaid,
// part-paid and paid; otherwise it's kept, including older statuses such as "completed".
export function settleAfterEdit(original: Invoice, newTotal: number, today: string) {
  const paid = original.amount_paid || 0;
  const stateFor = (total: number): PaymentState =>
    paid <= 0 ? 'unpaid' : total - paid <= 0.005 ? 'paid' : 'partially_paid';
  const before = stateFor(original.total);
  const after = stateFor(newTotal);
  const changed = before !== after;
  return {
    balance_due: Math.max(0, newTotal - paid),
    status: (changed ? after : original.status) as Invoice['status'],
    paid_date: changed ? (after === 'paid' ? today : null) : original.paid_date,
  };
}

// YYYY-MM-DD in the browser's own timezone, the same way appointments are created.
export function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA');
}

// Same time of day, different date.
export function moveToDate(iso: string, ymd: string): string {
  const original = new Date(iso);
  const moved = new Date(`${ymd}T00:00:00`);
  moved.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return moved.toISOString();
}
