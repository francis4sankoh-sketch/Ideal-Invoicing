'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { PurchaseOrder, PurchaseOrderItem, BusinessSettings } from '@/types';
import { formatCurrency, formatDateAU, generateId } from '@/lib/utils/format';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const supabase = createClient();

  const [form, setForm] = useState({
    supplier: '',
    items: [] as PurchaseOrderItem[],
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: '',
    notes: '',
    status: 'draft' as PurchaseOrder['status'],
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [ordersRes, settingsRes] = await Promise.all([
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('business_settings').select('*').limit(1).single(),
    ]);
    setOrders(ordersRes.data || []);
    setSettings(settingsRes.data);
    setLoading(false);
  };

  const openNew = () => {
    setEditingOrder(null);
    setForm({ supplier: '', items: [], order_date: new Date().toISOString().split('T')[0], expected_delivery: '', notes: '', status: 'draft' });
    setModalOpen(true);
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditingOrder(po);
    setForm({
      supplier: po.supplier,
      items: po.items || [],
      order_date: po.order_date || new Date().toISOString().split('T')[0],
      expected_delivery: po.expected_delivery || '',
      notes: po.notes || '',
      status: po.status,
    });
    setModalOpen(true);
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit_price: 0, total: 0 }] });
  };

  const updateItem = (idx: number, field: keyof PurchaseOrderItem, value: string | number) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      items[idx].total = items[idx].quantity * items[idx].unit_price;
    }
    setForm({ ...form, items });
  };

  const removeItem = (idx: number) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    if (!form.supplier) return;
    setSaving(true);

    const subtotal = form.items.reduce((s, i) => s + i.total, 0);
    const gstAmount = subtotal * 0.1;
    const total = subtotal + gstAmount;

    const poNumber = editingOrder?.order_number || `PO-${Date.now().toString().slice(-6)}`;

    const payload = {
      order_number: poNumber,
      supplier: form.supplier,
      items: form.items,
      subtotal,
      gst_amount: gstAmount,
      total,
      order_date: form.order_date || null,
      expected_delivery: form.expected_delivery || null,
      notes: form.notes || null,
      status: form.status,
    };

    if (editingOrder) {
      await supabase.from('purchase_orders').update(payload).eq('id', editingOrder.id);
    } else {
      await supabase.from('purchase_orders').insert(payload);
    }

    setModalOpen(false);
    setSaving(false);
    loadData();
  };

  const filtered = orders.filter((o) => !statusFilter || o.status === statusFilter);

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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a]"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="ordered">Ordered</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" /> New Purchase Order
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No purchase orders"
          description="Track your supply orders here."
          action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Create PO</Button>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">PO #</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Supplier</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-center">Items</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Order Date</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Expected</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((po) => (
                  <tr key={po.id} onClick={() => openEdit(po)} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-light)] cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-primary)]">{po.order_number}</td>
                    <td className="px-4 py-3">{po.supplier}</td>
                    <td className="px-4 py-3 text-center">{po.items?.length || 0}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(po.total)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{po.order_date ? formatDateAU(po.order_date) : '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{po.expected_delivery ? formatDateAU(po.expected_delivery) : '—'}</td>
                    <td className="px-4 py-3"><Badge status={po.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingOrder ? 'Edit Purchase Order' : 'New Purchase Order'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Supplier *" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PurchaseOrder['status'] })}>
              <option value="draft">Draft</option>
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Input label="Order Date" type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
            <Input label="Expected Delivery" type="date" value={form.expected_delivery} onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })} />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Items</label>
              <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3" /> Add Item</Button>
            </div>
            {form.items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <input value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} placeholder="Description" className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a]" />
                <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="w-16 px-2 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] text-center" />
                <input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-24 px-2 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] text-right" />
                <span className="w-24 text-sm text-right font-medium">{formatCurrency(item.total)}</span>
                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {form.items.length > 0 && (
              <div className="text-right mt-2">
                <p className="text-sm">Subtotal: <strong>{formatCurrency(form.items.reduce((s, i) => s + i.total, 0))}</strong></p>
                <p className="text-sm">GST (10%): <strong>{formatCurrency(form.items.reduce((s, i) => s + i.total, 0) * 0.1)}</strong></p>
                <p className="text-sm font-bold">Total: {formatCurrency(form.items.reduce((s, i) => s + i.total, 0) * 1.1)}</p>
              </div>
            )}
          </div>

          <Textarea label="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingOrder ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  );
}
