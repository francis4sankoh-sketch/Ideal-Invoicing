'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDateAU } from '@/lib/utils/format';
import {
  DollarSign,
  FileText,
  Calendar,
  Mail,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Receipt,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  outstandingCount: number;
  outstandingTotal: number;
  upcomingJobs: number;
  newEnquiries: number;
}

interface EventProfit {
  id: string;
  invoice_number: string;
  title: string;
  event_date: string | null;
  total: number;
  amount_paid: number;
  expenses: number;
  profit: number;
  customer_name: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    monthlyProfit: 0,
    outstandingCount: 0,
    outstandingTotal: 0,
    upcomingJobs: 0,
    newEnquiries: 0,
  });
  const [recentQuotes, setRecentQuotes] = useState<Array<{ id: string; quote_number: string; title: string; status: string; total: number; created_at: string }>>([]);
  const [recentPayments, setRecentPayments] = useState<Array<{ id: string; invoice_number: string; title: string; amount_paid: number; total: number }>>([]);
  const [eventProfits, setEventProfits] = useState<EventProfit[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [invoicesRes, quotesRes, appointmentsRes, enquiriesRes, recentQuotesRes, paidInvoicesRes, expensesRes, profitInvoicesRes] = await Promise.all([
      supabase.from('invoices').select('total, amount_paid, balance_due, status, paid_date'),
      supabase.from('quotes').select('id, quote_number, title, status, total, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('appointments').select('id').gte('start_time', now.toISOString()).lte('start_time', endOfWeek).eq('status', 'scheduled'),
      supabase.from('website_enquiries').select('id').eq('status', 'new'),
      supabase.from('quotes').select('id, quote_number, title, status, total, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('invoices').select('id, invoice_number, title, amount_paid, total').gt('amount_paid', 0).order('updated_at', { ascending: false }).limit(5),
      supabase.from('expenses').select('amount, date, invoice_id'),
      supabase.from('invoices').select('id, invoice_number, title, event_date, total, amount_paid, customer:customers(contact_name)').not('event_date', 'is', null).order('event_date', { ascending: false }).limit(10),
    ]);

    const invoices = invoicesRes.data || [];
    const allExpenses = expensesRes.data || [];
    const monthRevenue = invoices
      .filter(i => i.paid_date && new Date(i.paid_date) >= new Date(startOfMonth))
      .reduce((sum, i) => sum + (i.amount_paid || 0), 0);

    const monthExpenses = allExpenses
      .filter(e => e.date && new Date(e.date) >= new Date(startOfMonth))
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const outstanding = invoices.filter(i => i.status === 'unpaid' || i.status === 'partially_paid' || i.status === 'overdue');

    setStats({
      monthlyRevenue: monthRevenue,
      monthlyExpenses: monthExpenses,
      monthlyProfit: monthRevenue - monthExpenses,
      outstandingCount: outstanding.length,
      outstandingTotal: outstanding.reduce((sum, i) => sum + (i.balance_due || 0), 0),
      upcomingJobs: appointmentsRes.data?.length || 0,
      newEnquiries: enquiriesRes.data?.length || 0,
    });

    // Build event profitability
    const profitInvoices = profitInvoicesRes.data || [];
    const eventProfitData: EventProfit[] = profitInvoices.map((inv: any) => {
      const invExpenses = allExpenses.filter(e => e.invoice_id === inv.id).reduce((sum, e) => sum + (e.amount || 0), 0);
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        title: inv.title || '',
        event_date: inv.event_date,
        total: inv.total,
        amount_paid: inv.amount_paid,
        expenses: invExpenses,
        profit: inv.amount_paid - invExpenses,
        customer_name: inv.customer?.contact_name || '',
      };
    });
    setEventProfits(eventProfitData);

    setRecentQuotes(recentQuotesRes.data || []);
    setRecentPayments(paidInvoicesRes.data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/quotes/new">
          <Button><Plus className="w-4 h-4" /> New Quote</Button>
        </Link>
        <Link href="/customers">
          <Button variant="outline"><Plus className="w-4 h-4" /> New Customer</Button>
        </Link>
        <Link href="/calendar">
          <Button variant="outline"><Calendar className="w-4 h-4" /> New Appointment</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Revenue This Month</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(stats.monthlyRevenue)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Expenses This Month</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(stats.monthlyExpenses)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-full ${stats.monthlyProfit >= 0 ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center`}>
              {stats.monthlyProfit >= 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Profit This Month</p>
              <p className={`text-lg font-bold ${stats.monthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(stats.monthlyProfit)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Outstanding</p>
              <p className="text-lg font-bold text-[var(--color-text)]">{stats.outstandingCount} &middot; {formatCurrency(stats.outstandingTotal)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Upcoming (7 days)</p>
              <p className="text-lg font-bold text-[var(--color-text)]">{stats.upcomingJobs}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">New Enquiries</p>
              <p className="text-lg font-bold text-[var(--color-text)]">{stats.newEnquiries}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Quotes */}
        <Card>
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="font-bold text-[var(--color-text)]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Recent Quotes
            </h3>
            <Link href="/quotes" className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <CardContent className="p-0">
            {recentQuotes.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] p-6">No quotes yet</p>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {recentQuotes.map((q) => (
                  <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-[var(--color-bg-light)] transition-colors">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{q.quote_number} — {q.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{formatDateAU(q.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{formatCurrency(q.total)}</span>
                      <Badge status={q.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="font-bold text-[var(--color-text)]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Recent Payments
            </h3>
            <Link href="/invoices" className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <CardContent className="p-0">
            {recentPayments.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] p-6">No payments yet</p>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {recentPayments.map((p) => (
                  <Link key={p.id} href={`/invoices/${p.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-[var(--color-bg-light)] transition-colors">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{p.invoice_number} — {p.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">{formatCurrency(p.amount_paid)} paid</p>
                      <p className="text-xs text-[var(--color-text-muted)]">of {formatCurrency(p.total)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Event Profitability */}
      <Card>
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="font-bold text-[var(--color-text)]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Event Profitability
          </h3>
          <Link href="/expenses" className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1">
            Manage Expenses <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <CardContent className="p-0">
          {eventProfits.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] p-6">No events with invoices yet. Profit tracking will appear here once you have invoices with event dates.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left">
                    <th className="px-6 py-3 font-medium text-[var(--color-text-muted)]">Event</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Customer</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Date</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Invoice</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Paid</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Expenses</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {eventProfits.map((ep) => (
                    <Link key={ep.id} href={`/invoices/${ep.id}`} className="contents">
                      <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-light)] cursor-pointer transition-colors">
                        <td className="px-6 py-3">
                          <p className="font-medium">{ep.invoice_number}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{ep.title}</p>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">{ep.customer_name}</td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">{ep.event_date ? formatDateAU(ep.event_date) : '—'}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(ep.total)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{formatCurrency(ep.amount_paid)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{ep.expenses > 0 ? formatCurrency(ep.expenses) : '—'}</td>
                        <td className={`px-4 py-3 text-right font-bold ${ep.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(ep.profit)}
                        </td>
                      </tr>
                    </Link>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
