'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, DollarSign, FileCheck, Mail, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ReviewRequestButton } from '@/components/shared/review-request-button';
import { formatCurrency, formatDateAU } from '@/lib/utils/format';
import { daysBetween } from '@/lib/utils/money';
import type { Todo, TodoInvoice } from '@/lib/utils/todo';

const SHOW = 4;

function Section({
  icon: Icon,
  tone,
  title,
  hint,
  rows,
  footer,
}: {
  icon: typeof Mail;
  tone: string;
  title: string;
  hint: string;
  rows: React.ReactNode[];
  footer?: React.ReactNode;
}) {
  const [all, setAll] = useState(false);
  if (rows.length === 0) return null;
  return (
    <section>
      <div className="flex items-start gap-3 px-4 md:px-6 pt-4 pb-2">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone}`} />
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text)]">
            {title} <span className="text-[var(--color-text-muted)] font-normal">({rows.length})</span>
          </h4>
          <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
        </div>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">{all ? rows : rows.slice(0, SHOW)}</ul>
      <div className="px-4 md:px-6 pb-3 text-xs flex flex-wrap gap-x-4">
        {rows.length > SHOW && (
          <button onClick={() => setAll((v) => !v)} className="text-[var(--color-primary)] hover:underline py-1">
            {all ? 'Show fewer' : `Show all ${rows.length}`}
          </button>
        )}
        {footer}
      </div>
    </section>
  );
}

function Row({ href, title, sub, right }: { href: string; title: string; sub: string; right: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 md:px-6 py-2.5">
      <Link href={href} className="min-w-0 flex-1 group">
        <p className="text-sm font-medium text-[var(--color-text)] truncate group-hover:underline">{title}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{sub}</p>
      </Link>
      <div className="shrink-0 text-right">{right}</div>
    </li>
  );
}

const who = (i: TodoInvoice) => `${i.customer?.contact_name || 'No customer'} · ${i.invoice_number}`;

export function TodoList({ todo, today, onChanged }: { todo: Todo; today: string; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Takes the customer off the review list for good. Nothing is sent.
  const skipReview = async (customerId: string) => {
    setBusy(customerId);
    setError('');
    const { error } = await createClient()
      .from('customers')
      .update({ review_skipped_at: new Date().toISOString() })
      .eq('id', customerId);
    setBusy(null);
    if (error) setError(`That didn't save: ${error.message}`);
    else onChanged();
  };

  const empty =
    todo.overdue.length + todo.deposits.length + todo.acceptance.length + todo.enquiries.length + todo.reviews.length === 0;

  const inDays = (date: string) => {
    const n = daysBetween(today, date);
    return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
  };

  return (
    <Card>
      <div className="px-4 md:px-6 py-4 border-b border-[var(--color-border)]">
        <h3 className="font-bold text-[var(--color-text)]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          To Do
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Nothing here sends by itself. Open an item to act on it.</p>
      </div>

      {error && <p className="mx-4 md:mx-6 mt-3 text-sm bg-red-50 text-red-700 rounded-md p-3">{error}</p>}

      {empty ? (
        <p className="flex items-center gap-2 px-4 md:px-6 py-6 text-sm text-[var(--color-text-muted)]">
          <CheckCircle2 className="w-4 h-4 text-green-600" /> You&apos;re all caught up.
        </p>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          <Section
            icon={AlertTriangle}
            tone="text-red-600"
            title="Overdue balances"
            hint="Past the due date with money still owing."
            rows={todo.overdue.map((i) => (
              <Row
                key={i.id}
                href={`/invoices/${i.id}`}
                title={i.title || i.invoice_number}
                sub={`${who(i)} · ${i.last_reminder_sent ? `reminded ${formatDateAU(i.last_reminder_sent)}` : 'no reminder sent'}`}
                right={
                  <>
                    <p className="text-sm font-bold text-red-600">{formatCurrency(i.balance_due)}</p>
                    <p className="text-xs text-red-600">
                      {daysBetween(i.due_date!, today) === 1 ? '1 day late' : `${daysBetween(i.due_date!, today)} days late`}
                    </p>
                  </>
                }
              />
            ))}
          />
          <Section
            icon={DollarSign}
            tone="text-amber-600"
            title="Deposits not paid"
            hint="Upcoming events without a full deposit."
            rows={todo.deposits.map((i) => (
              <Row
                key={i.id}
                href={`/invoices/${i.id}`}
                title={i.title || i.invoice_number}
                sub={who(i)}
                right={
                  <>
                    <p className="text-sm font-medium">{formatCurrency(Math.max(0, i.deposit_amount - i.amount_paid))}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{inDays(i.event_date!)}</p>
                  </>
                }
              />
            ))}
          />
          <Section
            icon={FileCheck}
            tone="text-purple-600"
            title="Not accepted yet"
            hint="Events in the next 60 days where the customer hasn't accepted your terms online."
            rows={todo.acceptance.map((i) => (
              <Row
                key={i.id}
                href={`/invoices/${i.id}`}
                title={i.title || i.invoice_number}
                sub={who(i)}
                right={<p className="text-xs text-[var(--color-text-muted)]">{inDays(i.event_date!)}</p>}
              />
            ))}
          />
          <Section
            icon={Mail}
            tone="text-blue-600"
            title="Enquiries waiting"
            hint="Still marked new, with the event ahead or no date given."
            rows={todo.enquiries.map((e) => (
              <Row
                key={e.id}
                href="/enquiries"
                title={[e.name, e.event_type].filter(Boolean).join(' · ')}
                sub={`Received ${formatDateAU(e.created_at)}`}
                right={
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {e.event_date ? formatDateAU(e.event_date) : 'No date'}
                  </p>
                }
              />
            ))}
            footer={
              todo.pastEnquiries > 0 && (
                <Link href="/enquiries" className="text-[var(--color-text-muted)] hover:underline py-1">
                  {todo.pastEnquiries} more marked new with dates that have passed
                </Link>
              )
            }
          />
          <Section
            icon={Star}
            tone="text-yellow-600"
            title="Ready for a review"
            hint="Paid events from the last 6 months. Skip takes someone off this list."
            rows={todo.reviews.map((i) => (
              <li
                key={i.customer.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 md:px-6 py-2.5"
              >
                <Link href={`/customers/${i.customer.id}`} className="min-w-0 flex-1 group">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate group-hover:underline">
                    {i.customer.contact_name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {i.title || i.invoice_number} · {formatDateAU(i.event_date!)}
                  </p>
                </Link>
                <div className="flex gap-2 shrink-0">
                  <ReviewRequestButton customer={i.customer} onSent={onChanged} />
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busy === i.customer.id}
                    onClick={() => skipReview(i.customer.id)}
                  >
                    Skip
                  </Button>
                </div>
              </li>
            ))}
          />
        </div>
      )}
    </Card>
  );
}
