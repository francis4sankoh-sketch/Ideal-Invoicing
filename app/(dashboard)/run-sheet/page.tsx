'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateAU } from '@/lib/utils/format';
import { LineItem } from '@/types';
import { Truck, Printer, MapPin, Phone, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

type RangeMode = 'day' | 'week';

interface RunEvent {
  id: string;
  ref: string;
  title: string;
  customer_name: string;
  customer_phone: string | null;
  event_date: string;
  event_location: string | null;
  type: 'invoice' | 'quote';
  status: string;
  items: { description: string; quantity: number; notes: string }[];
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function RunSheetPage() {
  const [mode, setMode] = useState<RangeMode>('day');
  const [anchor, setAnchor] = useState<string>(toISODate(new Date()));
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const getRange = useCallback((): { start: string; end: string } => {
    const base = new Date(anchor + 'T00:00:00');
    if (mode === 'day') return { start: toISODate(base), end: toISODate(base) };
    const start = startOfWeek(base);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toISODate(start), end: toISODate(end) };
  }, [mode, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = getRange();

    const [invRes, quoteRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, title, event_date, event_location, line_items, status, customer:customers(contact_name, phone)')
        .gte('event_date', start)
        .lte('event_date', end)
        .neq('status', 'cancelled')
        .order('event_date', { ascending: true }),
      // Accepted quotes that haven't been turned into an invoice yet
      supabase
        .from('quotes')
        .select('id, quote_number, title, event_date, event_location, line_items, status, customer:customers(contact_name, phone)')
        .gte('event_date', start)
        .lte('event_date', end)
        .eq('status', 'accepted')
        .is('invoice_id', null)
        .order('event_date', { ascending: true }),
    ]);

    const mapItems = (li: LineItem[] | undefined) =>
      (li || []).map((i) => ({ description: i.description || '', quantity: i.quantity || 0, notes: i.notes || '' }));

    const invEvents: RunEvent[] = (invRes.data || []).map((inv) => {
      const c = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
      return {
        id: inv.id,
        ref: inv.invoice_number,
        title: inv.title || '',
        customer_name: c?.contact_name || '',
        customer_phone: c?.phone || null,
        event_date: inv.event_date,
        event_location: inv.event_location,
        type: 'invoice' as const,
        status: inv.status,
        items: mapItems(inv.line_items as LineItem[]),
      };
    });

    const quoteEvents: RunEvent[] = (quoteRes.data || []).map((q) => {
      const c = Array.isArray(q.customer) ? q.customer[0] : q.customer;
      return {
        id: q.id,
        ref: q.quote_number,
        title: q.title || '',
        customer_name: c?.contact_name || '',
        customer_phone: c?.phone || null,
        event_date: q.event_date,
        event_location: q.event_location,
        type: 'quote' as const,
        status: q.status,
        items: mapItems(q.line_items as LineItem[]),
      };
    });

    const all = [...invEvents, ...quoteEvents].sort(
      (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );
    setEvents(all);
    setLoading(false);
  }, [getRange, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const shift = (dir: number) => {
    const base = new Date(anchor + 'T00:00:00');
    base.setDate(base.getDate() + dir * (mode === 'day' ? 1 : 7));
    setAnchor(toISODate(base));
  };

  // Aggregate tally of every item across all events in range
  const tally = (() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      for (const it of ev.items) {
        const key = it.description.trim();
        if (!key) continue;
        map.set(key, (map.get(key) || 0) + it.quantity);
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  })();

  const { start, end } = getRange();
  const rangeLabel =
    mode === 'day'
      ? formatDateAU(start)
      : `${formatDateAU(start)} – ${formatDateAU(end)}`;

  return (
    <div className="space-y-6">
      {/* Controls (hidden on print) */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-[var(--color-border)]">
            <button
              onClick={() => setMode('day')}
              className={`px-3 py-1.5 text-sm font-medium ${mode === 'day' ? 'bg-[var(--color-primary)] text-white' : 'bg-white dark:bg-[#1a1a1a] text-[var(--color-text-muted)]'}`}
            >
              Day
            </button>
            <button
              onClick={() => setMode('week')}
              className={`px-3 py-1.5 text-sm font-medium ${mode === 'week' ? 'bg-[var(--color-primary)] text-white' : 'bg-white dark:bg-[#1a1a1a] text-[var(--color-text-muted)]'}`}
            >
              Week
            </button>
          </div>
          <button onClick={() => shift(-1)} className="p-2 rounded-md hover:bg-[var(--color-bg-light)]" aria-label="Previous">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            className="px-2 py-1.5 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a]"
          />
          <button onClick={() => shift(1)} className="p-2 rounded-md hover:bg-[var(--color-bg-light)]" aria-label="Next">
            <ChevronRight className="w-4 h-4" />
          </button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(toISODate(new Date()))}>
            Today
          </Button>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> Print
        </Button>
      </div>

      {/* Print header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0 print:hidden">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Delivery Run Sheet
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {rangeLabel} · {events.length} event{events.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)]" />
            <p className="text-[var(--color-text-muted)]">No events with items for {rangeLabel}.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Per-event cards */}
          <div className="space-y-4">
            {events.map((ev) => (
              <Card key={`${ev.type}-${ev.id}`} className="print:break-inside-avoid">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between flex-wrap gap-2 border-b border-[var(--color-border)] pb-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[var(--color-text)]">{ev.title || ev.ref}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-light)] text-[var(--color-text-muted)]">
                          {ev.ref}
                        </span>
                        {ev.type === 'quote' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Quote (not invoiced)</span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">{ev.customer_name}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium flex items-center gap-1 justify-end">
                        <CalendarDays className="w-3.5 h-3.5" /> {formatDateAU(ev.event_date)}
                      </p>
                      {ev.customer_phone && (
                        <p className="text-[var(--color-text-muted)] flex items-center gap-1 justify-end mt-0.5">
                          <Phone className="w-3 h-3" /> {ev.customer_phone}
                        </p>
                      )}
                      {ev.event_location && (
                        <p className="text-[var(--color-text-muted)] flex items-center gap-1 justify-end mt-0.5">
                          <MapPin className="w-3 h-3" /> {ev.event_location}
                        </p>
                      )}
                    </div>
                  </div>

                  {ev.items.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] italic">No items listed.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                          <th className="w-10 py-1">✓</th>
                          <th className="w-16 py-1">Qty</th>
                          <th className="py-1">Item</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ev.items.map((it, i) => (
                          <tr key={i} className="border-t border-[var(--color-border)]">
                            <td className="py-2">
                              <span className="inline-block w-4 h-4 border border-[var(--color-text-muted)] rounded-sm" />
                            </td>
                            <td className="py-2 font-bold">{it.quantity}</td>
                            <td className="py-2">
                              {it.description}
                              {it.notes && (
                                <span className="block text-xs text-[var(--color-text-muted)] whitespace-pre-line">{it.notes}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Aggregate tally */}
          {tally.length > 0 && (
            <Card className="print:break-inside-avoid">
              <CardContent className="py-4">
                <h3 className="font-bold text-[var(--color-text)] mb-3" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  Total Load — All Items ({rangeLabel})
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                      <th className="w-10 py-1">✓</th>
                      <th className="w-20 py-1">Total</th>
                      <th className="py-1">Item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tally.map(([name, qty]) => (
                      <tr key={name} className="border-t border-[var(--color-border)]">
                        <td className="py-2">
                          <span className="inline-block w-4 h-4 border border-[var(--color-text-muted)] rounded-sm" />
                        </td>
                        <td className="py-2 font-bold">{qty}</td>
                        <td className="py-2">{name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
