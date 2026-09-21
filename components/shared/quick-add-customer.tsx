'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Customer, AUSTRALIAN_STATES } from '@/types';

interface QuickAddCustomerProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

const BLANK_FORM = {
  business_name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postcode: '',
  notes: '',
};

// Condensed version of the Customers page's create form, for use inline
// while building a quote/invoice so there's no need to leave the page.
export function QuickAddCustomer({ open, onClose, onCreated }: QuickAddCustomerProps) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);

  const handleClose = () => {
    onClose();
    setForm(BLANK_FORM);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.contact_name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setSaving(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('customers')
      .insert(form)
      .select()
      .single();

    setSaving(false);
    if (err || !data) {
      setError(err?.message || 'Failed to create customer.');
      return;
    }
    onCreated(data);
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="New Customer" size="lg">
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
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Create Customer</Button>
      </div>
    </Modal>
  );
}
