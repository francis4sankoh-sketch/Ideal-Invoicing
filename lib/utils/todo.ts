import type { Customer, Invoice } from '@/types';
import { daysBetween, depositMet, isOverdue, roundCents } from './money';

// Works out the dashboard's to-do list. Nothing here sends anything.

export type TodoCustomer = Pick<Customer, 'id' | 'contact_name' | 'email' | 'review_requested_at' | 'review_skipped_at'>;

export type TodoInvoice = Pick<
  Invoice,
  | 'id' | 'invoice_number' | 'title' | 'status' | 'event_date' | 'due_date' | 'total' | 'deposit_amount'
  | 'amount_paid' | 'balance_due' | 'terms' | 'terms_accepted_at' | 'last_reminder_sent'
> & { customer: TodoCustomer | null };

export type TodoEnquiry = {
  id: string;
  name: string;
  event_type: string | null;
  event_date: string | null;
  created_at: string;
};

const ACCEPT_WITHIN_DAYS = 60; // only chase acceptance once the event is getting close
const REVIEW_WITHIN_DAYS = 180; // asking long after the event rarely works
const OPEN = ['unpaid', 'partially_paid', 'overdue'];

const byDate = (a: string | null, b: string | null) => (a || '9999').localeCompare(b || '9999');

export function buildTodo(invoices: TodoInvoice[], enquiries: TodoEnquiry[], today: string) {
  const ahead = (d: string | null) => !!d && d.slice(0, 10) >= today;

  const overdue = invoices.filter((i) => isOverdue(i, today)).sort((a, b) => byDate(a.due_date, b.due_date));

  // Late balances are already listed above, so they aren't repeated here.
  const deposits = invoices
    .filter(
      (i) =>
        OPEN.includes(i.status) &&
        ahead(i.event_date) &&
        roundCents(i.deposit_amount || 0) > 0 &&
        !depositMet(i) &&
        !isOverdue(i, today)
    )
    .sort((a, b) => byDate(a.event_date, b.event_date));

  const acceptance = invoices
    .filter(
      (i) =>
        OPEN.includes(i.status) &&
        ahead(i.event_date) &&
        daysBetween(today, i.event_date!) <= ACCEPT_WITHIN_DAYS &&
        !!i.terms?.trim() &&
        !i.terms_accepted_at
    )
    .sort((a, b) => byDate(a.event_date, b.event_date));

  const waiting = enquiries
    .filter((e) => !e.event_date || ahead(e.event_date))
    .sort((a, b) => byDate(a.event_date, b.event_date));
  const pastEnquiries = enquiries.length - waiting.length;

  // One row per customer: their most recent paid, finished event.
  const reviews = new Map<string, TodoInvoice & { customer: TodoCustomer }>();
  for (const i of invoices) {
    const c = i.customer;
    if (i.status !== 'paid' || !i.event_date || !c?.email || c.review_requested_at || c.review_skipped_at) continue;
    const ago = daysBetween(i.event_date, today);
    if (ago < 1 || ago > REVIEW_WITHIN_DAYS) continue;
    const seen = reviews.get(c.id);
    if (!seen || (seen.event_date || '') < i.event_date) reviews.set(c.id, { ...i, customer: c });
  }

  return {
    overdue,
    deposits,
    acceptance,
    enquiries: waiting,
    pastEnquiries,
    reviews: [...reviews.values()].sort((a, b) => byDate(b.event_date, a.event_date)),
  };
}

export type Todo = ReturnType<typeof buildTodo>;
