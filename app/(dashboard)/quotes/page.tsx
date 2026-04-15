'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Quote, Customer, LineItem } from '@/types';
import { formatCurrency, formatDateAU, generateId } from '@/lib/utils/format';
import { FileText, Plus, Search, Trash2, Copy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STATUSES = ['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'];

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<(Quote & { customer?: Customer })[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => { loadQuotes(); }, []);

  const loadQuotes = async () => {
    const { data } = await supabase
      .from('quotes')
      .select('*, customer:customers(*)')
      .order('created_at', { ascending: false });
    setQuotes(data || []);
    setLoading(false);
  };

  const handleDelete = async (q: Quote & { customer?: Customer }) => {
    if (q.converted_to_invoice) {
      alert(`This quote has been converted to an invoice and cannot be deleted. Delete the invoice first.`);
      return;
    }
    if (!confirm(`Delete quote ${q.quote_number}? This cannot be undone.`)) return;
    setBusyId(q.id);
    // Remove related messages first to satisfy FK constraints
    await supabase.from('quote_messages').delete().eq('quote_id', q.id);
    const { error } = await supabase.from('quotes').delete().eq('id', q.id);
    setBusyId(null);
    if (error) {
      alert(`Failed to delete quote: ${error.message}`);
      return;
    }
    setQuotes((prev) => prev.filter((x) => x.id !== q.id));
  };

  const handleDuplicate = async (q: Quote & { customer?: Customer }) => {
    setBusyId(q.id);
    // Pull fresh settings to get next quote number
    const { data: settings } = await supabase
      .from('business_settings')
      .select('*')
      .limit(1)
      .single();

    const quoteNumber = settings
      ? `${settings.quote_prefix}-${settings.next_quote_number}`
      : `${q.quote_number}-COPY`;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (settings?.default_quote_validity || 30));

    const freshLineItems: LineItem[] = (q.line_items || []).map((item) => ({
      ...item,
      id: generateId(),
    }));

    const payload = {
      quote_number: quoteNumber,
      customer_id: q.customer_id,
      title: `${q.title} (Copy)`,
      event_date: q.event_date,
      event_location: q.event_location,
      line_items: freshLineItems,
      subtotal: q.subtotal,
      discount_type: q.discount_type,
      discount_value: q.discount_value,
      discount_amount: q.discount_amount,
      include_gst: q.include_gst,
      gst_amount: q.gst_amount,
      total: q.total,
      deposit_percentage: q.deposit_percentage,
      deposit_amount: q.deposit_amount,
      status: 'draft' as const,
      valid_until: validUntil.toISOString().split('T')[0],
      notes: q.notes,
      terms: q.terms,
      converted_to_invoice: false,
      invoice_id: null,
    };

    const { data: created, error } = await supabase
      .from('quotes')
      .insert(payload)
      .select()
      .single();
    if (error) {
      setBusyId(null);
      alert(`Failed to duplicate quote: ${error.message}`);
      return;
    }

    if (settings) {
      await supabase
        .from('business_settings')
        .update({ next_quote_number: settings.next_quote_number + 1 })
        .eq('id', settings.id);
    }

    setBusyId(null);
    if (created) router.push(`/quotes/${created.id}`);
  };

  const filtered = quotes.filter((q) => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        q.quote_number?.toLowerCase().includes(s) ||
        q.title.toLowerCase().includes(s) ||
        q.customer?.contact_name.toLowerCase().includes(s) ||
        q.customer?.business_name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Count unread messages per quote
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (quotes.length === 0) return;
    const loadUnread = async () => {
      const { data } = await supabase
        .from('quote_messages')
        .select('quote_id')
        .eq('read', false)
        .eq('sender_type', 'customer');
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((m) => { counts[m.quote_id] = (counts[m.quote_id] || 0) + 1; });
        setUnreadCounts(counts);
      }
    };
    loadUnread();
  }, [quotes]);

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
              placeholder="Search quotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <div className="flex gap-1">
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
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <Link href="/quotes/new">
          <Button><Plus className="w-4 h-4" /> New Quote</Button>
        </Link>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotes found"
          description={statusFilter !== 'all' ? 'Try changing the filter.' : 'Create your first quote to get started.'}
          action={
            <Link href="/quotes/new">
              <Button><Plus className="w-4 h-4" /> New Quote</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Quote #</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Customer</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Title</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Event Date</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Deposit</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Status</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Created</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => (
                  <tr key={q.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-light)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/quotes/${q.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                        {q.quote_number}
                      </Link>
                      {unreadCounts[q.id] > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs">
                          {unreadCounts[q.id]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{q.customer?.contact_name || '—'}</td>
                    <td className="px-4 py-3">{q.title}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{q.event_date ? formatDateAU(q.event_date) : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(q.total)}</td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-muted)]">{formatCurrency(q.deposit_amount)}</td>
                    <td className="px-4 py-3"><Badge status={q.status} /></td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDateAU(q.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDuplicate(q)}
                          disabled={busyId === q.id}
                          title="Duplicate quote"
                          className="p-1.5 rounded hover:bg-[var(--color-bg-light)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-50"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(q)}
                          disabled={busyId === q.id || q.converted_to_invoice}
                          title={q.converted_to_invoice ? 'Converted to invoice — delete invoice first' : 'Delete quote'}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-muted)] hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
