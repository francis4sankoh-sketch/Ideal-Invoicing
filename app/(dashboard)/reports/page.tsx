'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
import { LineItem, Product } from '@/types';
import { BarChart3, TrendingUp, Package, ArrowUpDown } from 'lucide-react';

type RangePreset = 'all' | 'this_year' | 'this_quarter' | 'this_month' | 'custom';
type SortKey = 'revenue' | 'margin' | 'quantity' | 'hires' | 'name';

interface ItemStat {
  name: string;
  category: string | null;
  hires: number; // number of invoices this item appears in
  quantity: number; // total units hired
  revenue: number; // sum of line totals
  costPrice: number | null; // per-unit cost (if tracked)
  cost: number | null; // costPrice * quantity
  margin: number | null; // revenue - cost
  marginPct: number | null;
}

function norm(s: string) {
  return s.toLowerCase().trim();
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<RangePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [stats, setStats] = useState<ItemStat[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const getRange = useCallback((): { start: Date | null; end: Date | null; label: string } => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    switch (preset) {
      case 'all':
        return { start: null, end: null, label: 'All Time' };
      case 'this_year':
        return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), label: 'This Year' };
      case 'this_quarter': {
        const qs = Math.floor(m / 3) * 3;
        return { start: new Date(y, qs, 1), end: new Date(y, qs + 3, 1), label: 'This Quarter' };
      }
      case 'this_month':
        return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1), label: 'This Month' };
      case 'custom': {
        const start = customFrom ? new Date(customFrom) : null;
        const end = customTo ? new Date(new Date(customTo).getTime() + 86400000) : null;
        return { start, end, label: 'Custom Range' };
      }
      default:
        return { start: null, end: null, label: 'All Time' };
    }
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = getRange();

    let invQuery = supabase
      .from('invoices')
      .select('id, line_items, created_at, status')
      .neq('status', 'cancelled');
    if (start) invQuery = invQuery.gte('created_at', start.toISOString());
    if (end) invQuery = invQuery.lt('created_at', end.toISOString());

    const [invRes, prodRes] = await Promise.all([
      invQuery,
      supabase.from('products').select('name, category, cost_price'),
    ]);

    const products = (prodRes.data || []) as Pick<Product, 'name' | 'category' | 'cost_price'>[];
    const prodByName = new Map<string, { category: string | null; cost_price: number | null }>();
    for (const p of products) prodByName.set(norm(p.name), { category: p.category, cost_price: p.cost_price });

    const acc = new Map<string, ItemStat>();
    for (const inv of invRes.data || []) {
      const seenInThisInvoice = new Set<string>();
      for (const li of (inv.line_items as LineItem[]) || []) {
        const key = norm(li.description || '');
        if (!key) continue;
        const existing =
          acc.get(key) ||
          {
            name: li.description.trim(),
            category: prodByName.get(key)?.category ?? null,
            hires: 0,
            quantity: 0,
            revenue: 0,
            costPrice: prodByName.get(key)?.cost_price ?? null,
            cost: null,
            margin: null,
            marginPct: null,
          };
        existing.quantity += li.quantity || 0;
        existing.revenue += li.total || 0;
        if (!seenInThisInvoice.has(key)) {
          existing.hires += 1;
          seenInThisInvoice.add(key);
        }
        acc.set(key, existing);
      }
    }

    // Compute margins where cost is known
    const list = [...acc.values()].map((s) => {
      if (s.costPrice != null) {
        s.cost = s.costPrice * s.quantity;
        s.margin = s.revenue - s.cost;
        s.marginPct = s.revenue > 0 ? (s.margin / s.revenue) * 100 : null;
      }
      return s;
    });

    setStats(list);
    setLoading(false);
  }, [getRange, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = [...stats].sort((a, b) => {
    switch (sortKey) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'quantity':
        return b.quantity - a.quantity;
      case 'hires':
        return b.hires - a.hires;
      case 'margin':
        return (b.margin ?? -Infinity) - (a.margin ?? -Infinity);
      case 'revenue':
      default:
        return b.revenue - a.revenue;
    }
  });

  const totalRevenue = stats.reduce((s, i) => s + i.revenue, 0);
  const totalMargin = stats.reduce((s, i) => s + (i.margin ?? 0), 0);
  const trackedCount = stats.filter((s) => s.costPrice != null).length;
  const rangeLabel = getRange().label;

  const SortHeader = ({ label, k, className = '' }: { label: string; k: SortKey; className?: string }) => (
    <th className={`py-2 ${className}`}>
      <button
        onClick={() => setSortKey(k)}
        className={`inline-flex items-center gap-1 hover:text-[var(--color-text)] ${sortKey === k ? 'text-[var(--color-text)] font-semibold' : ''}`}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Item Profitability
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            What each item earns across your invoices · {rangeLabel}
          </p>
        </div>
      </div>

      {/* Range filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['all', 'All Time'],
          ['this_year', 'This Year'],
          ['this_quarter', 'This Quarter'],
          ['this_month', 'This Month'],
          ['custom', 'Custom'],
        ] as Array<[RangePreset, string]>).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setPreset(value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              preset === value
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-bg-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-2 py-1.5 border border-[var(--color-border)] rounded-md text-xs bg-white dark:bg-[#1a1a1a]" />
            <span className="text-xs text-[var(--color-text-muted)]">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-2 py-1.5 border border-[var(--color-border)] rounded-md text-xs bg-white dark:bg-[#1a1a1a]" />
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Total Revenue</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Margin (tracked items)</p>
              <p className="text-lg font-bold text-[var(--color-text)]">{formatCurrency(totalMargin)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Distinct Items</p>
              <p className="text-lg font-bold text-[var(--color-text)]">{stats.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {trackedCount < stats.length && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {stats.length - trackedCount} item{stats.length - trackedCount === 1 ? '' : 's'} have no cost set — add a &ldquo;Cost Per Hire&rdquo; on the Products page to see their margin.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
        </div>
      ) : stats.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)]" />
            <p className="text-[var(--color-text-muted)]">No invoiced items in {rangeLabel}.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)] px-6">
                  <SortHeader label="Item" k="name" className="pl-6 text-left" />
                  <SortHeader label="Hires" k="hires" className="text-right" />
                  <SortHeader label="Qty" k="quantity" className="text-right" />
                  <SortHeader label="Revenue" k="revenue" className="text-right" />
                  <th className="py-2 text-right">Cost</th>
                  <SortHeader label="Margin" k="margin" className="text-right" />
                  <th className="py-2 text-right pr-6">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.name} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-light)]">
                    <td className="py-3 pl-6">
                      <p className="font-medium">{s.name}</p>
                      {s.category && <p className="text-xs text-[var(--color-text-muted)]">{s.category}</p>}
                    </td>
                    <td className="py-3 text-right">{s.hires}</td>
                    <td className="py-3 text-right">{s.quantity}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(s.revenue)}</td>
                    <td className="py-3 text-right text-[var(--color-text-muted)]">{s.cost != null ? formatCurrency(s.cost) : '—'}</td>
                    <td className={`py-3 text-right font-medium ${s.margin == null ? 'text-[var(--color-text-muted)]' : s.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {s.margin != null ? formatCurrency(s.margin) : '—'}
                    </td>
                    <td className="py-3 text-right pr-6 text-[var(--color-text-muted)]">
                      {s.marginPct != null ? `${s.marginPct.toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
