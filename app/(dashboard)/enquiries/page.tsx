'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateAU, formatDatetime } from '@/lib/utils/format';
import { WebsiteEnquiry } from '@/types';
import {
  Mail,
  Search,
  Users as UsersIcon,
  DollarSign,
  Building2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileText,
  Phone,
} from 'lucide-react';

type EnquiryRow = WebsiteEnquiry & {
  quote?: { id: string; quote_number: string; status: string; total: number } | null;
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'converted', label: 'Converted' },
  { value: 'dismissed', label: 'Dismissed' },
];

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const supabase = createClient();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('website_enquiries')
      .select('*, quote:quotes(id, quote_number, status, total)')
      .order('created_at', { ascending: false });
    setEnquiries((data as EnquiryRow[]) || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: 'new' | 'converted' | 'dismissed') => {
    await supabase.from('website_enquiries').update({ status }).eq('id', id);
    await load();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enquiries.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.name?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        (e.phone || '').toLowerCase().includes(q) ||
        (e.event_location || '').toLowerCase().includes(q) ||
        (e.event_type || '').toLowerCase().includes(q) ||
        (e.budget_range || '').toLowerCase().includes(q) ||
        (e.guest_count || '').toLowerCase().includes(q)
      );
    });
  }, [enquiries, search, statusFilter]);

  const newCount = enquiries.filter((e) => e.status === 'new').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-text)]"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Website Enquiries
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Leads coming in from idealeventshire.com · {newCount} new
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <Input
            type="text"
            placeholder="Search name, email, phone, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-48"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Status: {o.label}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)]" />
            <p className="text-[var(--color-text-muted)]">
              {enquiries.length === 0
                ? 'No enquiries yet. When someone submits the website contact form they will appear here.'
                : 'No enquiries match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((enq) => (
            <Card key={enq.id}>
              <CardContent className="py-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[var(--color-text)] text-lg">{enq.name}</h3>
                      <Badge status={enq.status} />
                      {enq.source && enq.source !== 'website' && (
                        <span className="text-xs text-[var(--color-text-muted)] px-2 py-0.5 rounded-full bg-[var(--color-bg-light)]">
                          {enq.source}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      Received {formatDatetime(enq.created_at)}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {enq.quote?.id && (
                      <Link href={`/quotes/${enq.quote.id}`}>
                        <Button variant="outline" size="sm">
                          <FileText className="w-4 h-4" /> {enq.quote.quote_number}
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}
                    {enq.status !== 'converted' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(enq.id, 'converted')}
                      >
                        <CheckCircle2 className="w-4 h-4" /> Mark converted
                      </Button>
                    )}
                    {enq.status !== 'dismissed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(enq.id, 'dismissed')}
                      >
                        <XCircle className="w-4 h-4" /> Dismiss
                      </Button>
                    )}
                  </div>
                </div>

                {/* Contact */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                      Email
                    </div>
                    <a
                      href={`mailto:${enq.email}`}
                      className="text-[var(--color-primary)] hover:underline break-all"
                    >
                      {enq.email}
                    </a>
                  </div>
                  {enq.phone && (
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                        Phone
                      </div>
                      <a
                        href={`tel:${enq.phone}`}
                        className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" /> {enq.phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Event details + qualification */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm border-t border-[var(--color-border)] pt-4">
                  {enq.event_type && (
                    <DetailItem label="Event Type" value={enq.event_type} />
                  )}
                  {enq.event_date && (
                    <DetailItem label="Event Date" value={formatDateAU(enq.event_date)} />
                  )}
                  {enq.event_location && (
                    <DetailItem label="Location" value={enq.event_location} />
                  )}
                  {enq.guest_count && (
                    <DetailItem
                      label="Guest Count"
                      value={enq.guest_count}
                      icon={<UsersIcon className="w-3.5 h-3.5" />}
                      highlight
                    />
                  )}
                  {enq.budget_range && (
                    <DetailItem
                      label="Budget"
                      value={enq.budget_range}
                      icon={<DollarSign className="w-3.5 h-3.5" />}
                      highlight
                    />
                  )}
                  {enq.venue_access && (
                    <DetailItem
                      label="Venue Access"
                      value={enq.venue_access}
                      icon={<Building2 className="w-3.5 h-3.5" />}
                      highlight
                    />
                  )}
                </div>

                {/* Requested items */}
                {Array.isArray(enq.selected_items) && enq.selected_items.length > 0 && (
                  <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      Requested Items
                    </div>
                    <ul className="text-sm space-y-1">
                      {enq.selected_items.map((it, i) => (
                        <li key={i}>{renderItem(it)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Customer notes */}
                {enq.additional_notes && (
                  <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                      Customer Notes
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{enq.additional_notes}</p>
                  </div>
                )}

                {/* Linked quote summary */}
                {enq.quote && (
                  <div className="mt-4 border-t border-[var(--color-border)] pt-3 flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">
                      Linked quote:{' '}
                      <Link
                        href={`/quotes/${enq.quote.id}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {enq.quote.quote_number}
                      </Link>{' '}
                      ({enq.quote.status})
                    </span>
                    <span className="font-medium">
                      ${Number(enq.quote.total || 0).toFixed(2)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? 'rounded-md bg-[var(--color-bg-light)] px-3 py-2'
          : ''
      }
    >
      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-[var(--color-text)] font-medium mt-0.5">{value}</div>
    </div>
  );
}

function renderItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const i = item as {
      product_name?: string;
      equipment_name?: string;
      name?: string;
      quantity?: number;
    };
    const name = i.product_name || i.equipment_name || i.name || 'Item';
    const qty = i.quantity ?? 1;
    return `${name} × ${qty}`;
  }
  return String(item);
}
