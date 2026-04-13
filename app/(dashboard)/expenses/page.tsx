'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Expense, Quote, Invoice, EXPENSE_CATEGORIES } from '@/types';
import { formatCurrency, formatDateAU } from '@/lib/utils/format';
import { CreditCard, Plus, Search, Upload, Receipt, Link2 } from 'lucide-react';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [events, setEvents] = useState<{ id: string; label: string; type: 'quote' | 'invoice' }[]>([]);
  const supabase = createClient();

  const [form, setForm] = useState({
    description: '',
    category: 'materials' as Expense['category'],
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    receipt_url: '',
    notes: '',
    status: 'pending' as Expense['status'],
    linked_event: '', // format: "quote:id" or "invoice:id"
  });

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    const [expRes, quotesRes, invoicesRes] = await Promise.all([
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('quotes').select('id, quote_number, title, event_date, invoice_id, customer:customers(contact_name)').not('event_date', 'is', null).is('invoice_id', null).order('event_date', { ascending: false }),
      supabase.from('invoices').select('id, invoice_number, title, event_date, customer:customers(contact_name)').not('event_date', 'is', null).order('event_date', { ascending: false }),
    ]);
    setExpenses(expRes.data || []);

    // Build event options for the dropdown
    const eventOptions: { id: string; label: string; type: 'quote' | 'invoice' }[] = [];
    (invoicesRes.data || []).forEach((inv: any) => {
      const customer = inv.customer?.contact_name || '';
      const label = `🧾 ${inv.invoice_number} — ${inv.title || 'Untitled'}${customer ? ` (${customer})` : ''} — ${formatDateAU(inv.event_date)}`;
      eventOptions.push({ id: inv.id, label, type: 'invoice' });
    });
    (quotesRes.data || []).forEach((q: any) => {
      const customer = q.customer?.contact_name || '';
      const label = `📋 ${q.quote_number} — ${q.title || 'Untitled'}${customer ? ` (${customer})` : ''} — ${formatDateAU(q.event_date)}`;
      eventOptions.push({ id: q.id, label, type: 'quote' });
    });
    setEvents(eventOptions);
    setLoading(false);
  };

  const openNew = () => {
    setEditingExpense(null);
    setForm({ description: '', category: 'materials', amount: 0, date: new Date().toISOString().split('T')[0], receipt_url: '', notes: '', status: 'pending', linked_event: '' });
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditingExpense(e);
    const linked = e.invoice_id ? `invoice:${e.invoice_id}` : e.quote_id ? `quote:${e.quote_id}` : '';
    setForm({
      description: e.description,
      category: e.category,
      amount: e.amount,
      date: e.date,
      receipt_url: e.receipt_url || '',
      notes: e.notes || '',
      status: e.status,
      linked_event: linked,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);

    // Parse linked event
    let quote_id: string | null = null;
    let invoice_id: string | null = null;
    if (form.linked_event) {
      const [type, id] = form.linked_event.split(':');
      if (type === 'quote') quote_id = id;
      if (type === 'invoice') invoice_id = id;
    }

    const payload = {
      description: form.description,
      category: form.category,
      amount: form.amount,
      date: form.date,
      receipt_url: form.receipt_url || null,
      notes: form.notes || null,
      status: form.status,
      quote_id,
      invoice_id,
    };

    if (editingExpense) {
      await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
    } else {
      await supabase.from('expenses').insert(payload);
    }

    setModalOpen(false);
    setSaving(false);
    loadExpenses();
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `receipt-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('receipts').upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path);
      setForm({ ...form, receipt_url: publicUrl });
    }
  };

  // Category totals
  const categoryTotals = EXPENSE_CATEGORIES.map((cat) => ({
    category: cat,
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  }));

  const getEventLabel = (e: Expense): string | null => {
    if (e.invoice_id) {
      const ev = events.find((ev) => ev.type === 'invoice' && ev.id === e.invoice_id);
      return ev?.label || 'Invoice (linked)';
    }
    if (e.quote_id) {
      const ev = events.find((ev) => ev.type === 'quote' && ev.id === e.quote_id);
      return ev?.label || 'Quote (linked)';
    }
    return null;
  };

  const filtered = expenses.filter((e) => {
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    if (eventFilter === 'linked' && !e.quote_id && !e.invoice_id) return false;
    if (eventFilter === 'unlinked' && (e.quote_id || e.invoice_id)) return false;
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
      {/* Category Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {categoryTotals.map((ct) => (
          <Card key={ct.category}>
            <CardContent className="py-3 text-center">
              <p className="text-xs text-[var(--color-text-muted)] capitalize">{ct.category}</p>
              <p className="text-sm font-bold">{formatCurrency(ct.total)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a]"
          >
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a]"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a]"
          >
            <option value="">All expenses</option>
            <option value="linked">Linked to event</option>
            <option value="unlinked">Not linked</option>
          </select>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" /> New Expense
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No expenses found"
          description="Track your business expenses here."
          action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Add Expense</Button>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Date</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Description</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Event</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Category</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Status</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} onClick={() => openEdit(e)} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-light)] cursor-pointer transition-colors">
                    <td className="px-4 py-3">{formatDateAU(e.date)}</td>
                    <td className="px-4 py-3 font-medium">{e.description}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] max-w-[200px] truncate">
                      {getEventLabel(e) ? (
                        <span className="flex items-center gap-1">
                          <Link2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{getEventLabel(e)}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 capitalize text-[var(--color-text-muted)]">{e.category}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(e.amount)}</td>
                    <td className="px-4 py-3"><Badge status={e.status} /></td>
                    <td className="px-4 py-3">
                      {e.receipt_url ? (
                        <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline text-xs" onClick={(ev) => ev.stopPropagation()}>
                          View
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Expense Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingExpense ? 'Edit Expense' : 'New Expense'}>
        <div className="space-y-4">
          <Input label="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Category *" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Expense['category'] })}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </Select>
            <Input label="Amount *" type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Expense['status'] })}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </Select>
          </div>
          <Select label="Link to Event" value={form.linked_event} onChange={(e) => setForm({ ...form, linked_event: e.target.value })}>
            <option value="">No event linked</option>
            <optgroup label="Invoices">
              {events.filter((ev) => ev.type === 'invoice').map((ev) => (
                <option key={`invoice:${ev.id}`} value={`invoice:${ev.id}`}>{ev.label}</option>
              ))}
            </optgroup>
            <optgroup label="Quotes">
              {events.filter((ev) => ev.type === 'quote').map((ev) => (
                <option key={`quote:${ev.id}`} value={`quote:${ev.id}`}>{ev.label}</option>
              ))}
            </optgroup>
          </Select>
          <Textarea label="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Receipt</label>
            {form.receipt_url && (
              <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-primary)] hover:underline mb-2 block">
                View current receipt
              </a>
            )}
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 border border-[var(--color-border)] rounded-md text-sm hover:bg-[var(--color-bg-light)]">
              <Upload className="w-4 h-4" /> Upload Receipt
              <input type="file" accept="image/*" className="hidden" onChange={handleReceiptUpload} />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingExpense ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  );
}
