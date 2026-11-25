// Whole cents. Without this, 20% of $588 comes out as 117.60000000000001, and someone who paid
// $117.60 looks like they haven't paid their deposit.
export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// True when a deposit was asked for and has been paid, to the nearest cent.
export function depositMet(inv: { deposit_amount: number | null; amount_paid: number | null }, paid = inv.amount_paid || 0): boolean {
  const deposit = roundCents(inv.deposit_amount || 0);
  return deposit > 0 && roundCents(paid) >= deposit;
}

// Today as YYYY-MM-DD where the user is. (toISOString gives yesterday until late morning in Melbourne.)
export function todayLocal(now = new Date()): string {
  return now.toLocaleDateString('en-CA');
}

// Worked out from the due date and balance whenever it's shown, so it can't go stale.
// An invoice due today isn't overdue yet.
export function isOverdue(
  inv: { status: string; balance_due: number | null; due_date: string | null },
  today = todayLocal()
): boolean {
  return (
    ['unpaid', 'partially_paid', 'overdue'].includes(inv.status) &&
    roundCents(inv.balance_due || 0) > 0 &&
    !!inv.due_date &&
    inv.due_date.slice(0, 10) < today
  );
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  const utc = (s: string) => Date.parse(`${s.slice(0, 10)}T00:00:00Z`);
  return Math.round((utc(toYmd) - utc(fromYmd)) / 86_400_000);
}
