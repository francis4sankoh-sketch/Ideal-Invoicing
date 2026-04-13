'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Customer, Quote, Invoice } from '@/types';
import { formatCurrency, formatDateAU } from '@/lib/utils/format';
import { ArrowLeft, Copy, Mail, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const loadCustomer = async () => {
    const [cRes, qRes, iRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('quotes').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
    ]);
    if (cRes.data) setCustomer(cRes.data);
    setQuotes(qRes.data || []);
    setInvoices(iRes.data || []);
    setLoading(false);
  };

  const copyPortalLink = () => {
    if (!customer) return;
    const url = `${window.location.origin}/portal/${customer.portal_token}`;
    navigator.clipboard.writeText(url);
  };

  const totalQuoted = quotes.reduce((s, q) => s + q.total, 0);
  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.amount_paid, 0);
  const outstanding = invoices.reduce((s, i) => s + i.balance_due, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  if (!customer) return <p>Customer not found.</p>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </Link>

      {/* Profile */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-text)]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                {customer.contact_name}
              </h2>
              {customer.business_name && (
                <p className="text-sm text-[var(--color-text-muted)]">{customer.business_name}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {customer.email}</span>
                {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {customer.phone}</span>}
                {(customer.city || customer.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {[customer.city, customer.state, customer.postcode].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyPortalLink}>
                <Copy className="w-3.5 h-3.5" /> Copy Portal Link
              </Button>
              <Link href={`/quotes/new?customer=${customer.id}`}>
                <Button size="sm">New Quote</Button>
              </Link>
            </div>
          </div>

          {customer.notes && (
            <div className="mt-4 p-3 bg-[var(--color-accent-light)] rounded-md text-sm text-[var(--color-text-muted)]">
              <strong>Notes:</strong> {customer.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Quoted', value: formatCurrency(totalQuoted) },
          { label: 'Total Invoiced', value: formatCurrency(totalInvoiced) },
          { label: 'Total Paid', value: formatCurrency(totalPaid) },
          { label: 'Outstanding', value: formatCurrency(outstanding) },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-3 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">{stat.label}</p>
              <p className="text-lg font-bold text-[var(--color-text)]">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quotes */}
      <Card>
        <CardHeader>
          <h3 className="font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>Quotes</h3>
        </CardHeader>
        <div className="divide-y divide-[var(--color-border)]">
          {quotes.length === 0 ? (
            <p className="px-6 py-4 text-sm text-[var(--color-text-muted)]">No quotes yet</p>
          ) : (
            quotes.map((q) => (
              <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-[var(--color-bg-light)] transition-colors">
                <div>
                  <p className="text-sm font-medium">{q.quote_number} — {q.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{q.event_date ? formatDateAU(q.event_date) : 'No date'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{formatCurrency(q.total)}</span>
                  <Badge status={q.status} />
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <h3 className="font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>Invoices</h3>
        </CardHeader>
        <div className="divide-y divide-[var(--color-border)]">
          {invoices.length === 0 ? (
            <p className="px-6 py-4 text-sm text-[var(--color-text-muted)]">No invoices yet</p>
          ) : (
            invoices.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-[var(--color-bg-light)] transition-colors">
                <div>
                  <p className="text-sm font-medium">{inv.invoice_number} — {inv.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Due: {inv.due_date ? formatDateAU(inv.due_date) : 'Not set'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(inv.total)}</p>
                    {inv.balance_due > 0 && (
                      <p className="text-xs text-red-500">Due: {formatCurrency(inv.balance_due)}</p>
                    )}
                  </div>
                  <Badge status={inv.status} />
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
