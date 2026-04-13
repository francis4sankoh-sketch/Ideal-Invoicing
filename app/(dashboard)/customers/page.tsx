'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Customer, AUSTRALIAN_STATES } from '@/types';
import { formatDateAU } from '@/lib/utils/format';
import { Users, Plus, Search, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<(Customer & { quote_count: number; invoice_count: number })[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postcode: '',
    notes: '',
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (customerData) {
      const withCounts = await Promise.all(
        customerData.map(async (c) => {
          const [qRes, iRes] = await Promise.all([
            supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('customer_id', c.id),
            supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', c.id),
          ]);
          return { ...c, quote_count: qRes.count || 0, invoice_count: iRes.count || 0 };
        })
      );
      setCustomers(withCounts);
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditingCustomer(null);
    setForm({ business_name: '', contact_name: '', email: '', phone: '', address: '', city: '', state: '', postcode: '', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({
      business_name: c.business_name || '',
      contact_name: c.contact_name,
      email: c.email,
      phone: c.phone || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      postcode: c.postcode || '',
      notes: c.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.contact_name || !form.email) return;
    setSaving(true);

    if (editingCustomer) {
      await supabase.from('customers').update(form).eq('id', editingCustomer.id);
    } else {
      await supabase.from('customers').insert(form);
    }

    setModalOpen(false);
    setSaving(false);
    loadCustomers();
  };

  const copyPortalLink = (token: string) => {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
  };

  const filtered = customers.filter(
    (c) =>
      c.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.business_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" /> New Customer
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Create your first customer to get started with quotes and invoices."
          action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Add Customer</Button>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Name</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Business</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Email</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Phone</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">State</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-center">Quotes</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-center">Invoices</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Created</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-light)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                        {c.contact_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.business_name || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.email}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.state || '—'}</td>
                    <td className="px-4 py-3 text-center">{c.quote_count}</td>
                    <td className="px-4 py-3 text-center">{c.invoice_count}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDateAU(c.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyPortalLink(c.portal_token)}
                          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] rounded"
                          title="Copy portal link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] rounded text-xs"
                        >
                          Edit
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

      {/* Customer Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingCustomer ? 'Edit Customer' : 'New Customer'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Contact Name *" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} required />
          <Input label="Business Name" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
          <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="md:col-span-2">
            <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Select label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
            <option value="">Select state...</option>
            {AUSTRALIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Input label="Postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
          <div className="md:col-span-2">
            <Textarea label="Internal Notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingCustomer ? 'Update' : 'Create'} Customer</Button>
        </div>
      </Modal>
    </div>
  );
}
