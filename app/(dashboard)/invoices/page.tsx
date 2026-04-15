'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Invoice, Customer } from '@/types';
import { formatCurrency, formatDateAU } from '@/lib/utils/format';
import { Receipt, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';

const STATUSES = ['all', 'unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled'];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<(Invoice & { customer?: Customer })[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const supabase = createClient();

  const handleDelete = async (inv: Invoice & { customer?: Customer }) => {
    if (inv.amount_paid > 0) {
      alert('This invoice already has payments recorded and cannot be deleted. Cancel it instead.');
      return;
    }
    if (!confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    setBusyId(inv.id);
    // Unlink source quote so it becomes deletable again
    if (inv.quote_id) {
      await supabase
        .from('quotes')
        .update({ converted_to_invoice: false, invoice_id: null })
        .eq('id', inv.quote_id);
    }
    // Unlink any expenses pointing at this invoice
    await supabase.from('expenses').update({ invoice_id: null }).eq('invoice_id', inv.id);
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
    setBusyId(null);
    if (error) {
      alert(`Failed to delete invoice: ${error.message}`);
      return;
    }
    setInvoices((prev) => prev.filter((x) => x.id !== inv.id));
  };

  useEffect(() => { loadInvoices(); }, []);

  const loadInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('*, customer:customers(*)')
      .order('created_at', { ascending: false });
    setInvoices(data || []);
    setLoading(false);
  };

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(s) ||
        inv.title.toLowerCase().includes(s) ||
        inv.customer?.contact_name.toLowerCase().includes(s)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-white dark:bg-[#1a1a1a] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-bg-light)]'
                }`}
              >
                {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices found"
          description={statusFilter !== 'all' ? 'Try changing the filter.' : 'Invoices are created by converting accepted quotes.'}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Invoice #</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Customer</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Title</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Event Date</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Paid</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Balance</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Due Date</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Status</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`border-b border-[var(--color-border)] hover:bg-[var(--color-bg-light)] transition-colors ${
                      inv.status === 'overdue' ? 'bg-red-50 dark:bg-red-900/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{inv.customer?.contact_name || '—'}</td>
                    <td className="px-4 py-3">{inv.title}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{inv.event_date ? formatDateAU(inv.event_date) : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(inv.amount_paid)}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">{formatCurrency(inv.balance_due)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{inv.due_date ? formatDateAU(inv.due_date) : '—'}</td>
                    <td className="px-4 py-3"><Badge status={inv.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(inv)}
                        disabled={busyId === inv.id || inv.amount_paid > 0}
                        title={inv.amount_paid > 0 ? 'Has payments — cancel instead' : 'Delete invoice'}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-muted)] hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
