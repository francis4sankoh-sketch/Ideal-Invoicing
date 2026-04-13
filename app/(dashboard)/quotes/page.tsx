'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Quote, Customer } from '@/types';
import { formatCurrency, formatDateAU } from '@/lib/utils/format';
import { FileText, Plus, Search } from 'lucide-react';
import Link from 'next/link';

const STATUSES = ['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'];

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<(Quote & { customer?: Customer })[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => { loadQuotes(); }, []);

  const loadQuotes = async () => {
    const { data } = await supabase
      .from('quotes')
      .select('*, customer:customers(*)')
      .order('created_at', { ascending: false });
    setQuotes(data || []);
    setLoading(false);
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
