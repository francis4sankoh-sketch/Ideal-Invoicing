'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Invoice, Customer, BusinessSettings, Expense, PaymentRecord, PAYMENT_METHODS } from '@/types';
import { formatCurrency, formatDateAU, formatDateDocument } from '@/lib/utils/format';
import { ArrowLeft, Send, Bell, DollarSign, Ban, Copy, TrendingUp, TrendingDown, Receipt, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PDFDownloadButton } from '@/components/pdf-download-button';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [payment, setPayment] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'bank_transfer',
    notes: '',
  });

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    const [invRes, settingsRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).single(),
      supabase.from('business_settings').select('*').limit(1).single(),
    ]);

    if (invRes.data) {
      setInvoice(invRes.data);
      setPayment((p) => ({ ...p, amount: invRes.data.balance_due }));

      const [custRes, expensesRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', invRes.data.customer_id).single(),
        supabase.from('expenses').select('*').eq('invoice_id', id).order('date', { ascending: false }),
      ]);
      if (custRes.data) setCustomer(custRes.data);
      setExpenses(expensesRes.data || []);
    }
    if (settingsRes.data) setSettings(settingsRes.data);
    setLoading(false);
  };

  const handleRecordPayment = async () => {
    if (!invoice || payment.amount <= 0) return;
    setSaving(true);

    const newPayment: PaymentRecord = {
      date: payment.date,
      amount: payment.amount,
      payment_method: payment.payment_method,
      notes: payment.notes,
    };

    const paymentHistory = [...(invoice.payment_history || []), newPayment];
    const amountPaid = paymentHistory.reduce((s, p) => s + p.amount, 0);
    const balanceDue = invoice.total - amountPaid;
    let status: Invoice['status'] = 'partially_paid';
    if (balanceDue <= 0) status = 'paid';
    else if (balanceDue === invoice.total) status = 'unpaid';

    const updates = {
      payment_history: paymentHistory,
      amount_paid: amountPaid,
      balance_due: Math.max(0, balanceDue),
      status,
      paid_date: status === 'paid' ? new Date().toISOString().split('T')[0] : invoice.paid_date,
    };

    await supabase.from('invoices').update(updates).eq('id', invoice.id);
    setInvoice({ ...invoice, ...updates });

    // Send payment confirmation email
    if (customer) {
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'payment_confirmation',
            customerEmail: customer.email,
            customerName: customer.contact_name,
            invoiceNumber: invoice.invoice_number,
            amountPaid: formatCurrency(payment.amount),
            remainingBalance: formatCurrency(Math.max(0, balanceDue)),
          }),
        });
      } catch (err) {
        console.error('Failed to send confirmation:', err);
      }
    }

    setPaymentModalOpen(false);
    setSaving(false);
  };

  const handleSendInvoice = async () => {
    if (!invoice || !customer || !settings) return;
    setSaving(true);

    const portalUrl = `${window.location.origin}/portal/${customer.portal_token}?invoice=${invoice.id}`;
    const bankDetails = `
      <div class="detail-row"><span class="detail-label">Bank:</span> <span class="detail-value">${settings.bank_name || 'N/A'}</span></div>
      <div class="detail-row"><span class="detail-label">Account Name:</span> <span class="detail-value">${settings.account_name || 'N/A'}</span></div>
      <div class="detail-row"><span class="detail-label">BSB:</span> <span class="detail-value">${settings.bsb || 'N/A'}</span></div>
      <div class="detail-row"><span class="detail-label">Account Number:</span> <span class="detail-value">${settings.account_number || 'N/A'}</span></div>
      ${settings.bank_reference_note ? `<p style="margin-top:8px;font-size:12px;color:#555;">${settings.bank_reference_note}</p>` : ''}
    `;

    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invoice_sent',
          customerEmail: customer.email,
          customerName: customer.contact_name,
          invoiceNumber: invoice.invoice_number,
          total: formatCurrency(invoice.total),
          balanceDue: formatCurrency(invoice.balance_due),
          dueDate: invoice.due_date ? formatDateDocument(invoice.due_date) : 'Not set',
          bankDetails,
          portalUrl,
          subject: emailSubject,
          body: emailBody,
        }),
      });
      setSendModalOpen(false);
    } catch (err) {
      console.error('Failed to send:', err);
    }
    setSaving(false);
  };

  const handleSendReminder = async () => {
    if (!invoice || !customer || !settings) return;
    setSaving(true);

    const portalUrl = `${window.location.origin}/portal/${customer.portal_token}?invoice=${invoice.id}`;
    const bankDetails = `
      <div class="detail-row"><span class="detail-label">BSB:</span> <span class="detail-value">${settings.bsb || 'N/A'}</span></div>
      <div class="detail-row"><span class="detail-label">Account:</span> <span class="detail-value">${settings.account_number || 'N/A'}</span></div>
    `;

    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment_reminder',
          customerEmail: customer.email,
          customerName: customer.contact_name,
          invoiceNumber: invoice.invoice_number,
          balanceDue: formatCurrency(invoice.balance_due),
          dueDate: invoice.due_date ? formatDateDocument(invoice.due_date) : 'Not set',
          bankDetails,
          portalUrl,
        }),
      });

      await supabase.from('invoices').update({ last_reminder_sent: new Date().toISOString().split('T')[0] }).eq('id', invoice.id);
    } catch (err) {
      console.error('Failed to send reminder:', err);
    }
    setSaving(false);
  };

  const handleCancel = async () => {
    if (!invoice || !confirm('Are you sure you want to cancel this invoice?')) return;
    await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', invoice.id);
    setInvoice({ ...invoice, status: 'cancelled' });
  };

  const handleDelete = async () => {
    if (!invoice) return;
    if (invoice.amount_paid > 0) {
      alert('This invoice already has payments recorded and cannot be deleted. Cancel it instead.');
      return;
    }
    if (!confirm(`Delete invoice ${invoice.invoice_number}? This cannot be undone.`)) return;
    setSaving(true);
    if (invoice.quote_id) {
      await supabase
        .from('quotes')
        .update({ converted_to_invoice: false, invoice_id: null })
        .eq('id', invoice.quote_id);
    }
    await supabase.from('expenses').update({ invoice_id: null }).eq('invoice_id', invoice.id);
    const { error } = await supabase.from('invoices').delete().eq('id', invoice.id);
    setSaving(false);
    if (error) {
      alert(`Failed to delete invoice: ${error.message}`);
      return;
    }
    router.push('/invoices');
  };

  const copyPortalLink = () => {
    if (!customer || !invoice) return;
    navigator.clipboard.writeText(`${window.location.origin}/portal/${customer.portal_token}?invoice=${invoice.id}`);
  };

  if (loading || !invoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft className="w-4 h-4" /> Back to Invoices
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            {invoice.invoice_number}
          </h2>
          <Badge status={invoice.status} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={copyPortalLink}>
            <Copy className="w-3.5 h-3.5" /> Portal Link
          </Button>
          {settings && (
            <PDFDownloadButton type="invoice" data={invoice} customer={customer} settings={settings} />
          )}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <>
              <Button variant="outline" size="sm" onClick={handleSendReminder} loading={saving}>
                <Bell className="w-3.5 h-3.5" /> Send Reminder
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                setEmailSubject(`Invoice ${invoice.invoice_number} from Ideal Events Group`);
                setEmailBody('');
                setSendModalOpen(true);
              }}>
                <Send className="w-3.5 h-3.5" /> Send Invoice
              </Button>
              <Button size="sm" onClick={() => {
                setPayment({ date: new Date().toISOString().split('T')[0], amount: invoice.balance_due, payment_method: 'bank_transfer', notes: '' });
                setPaymentModalOpen(true);
              }}>
                <DollarSign className="w-3.5 h-3.5" /> Record Payment
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Invoice Display */}
      <Card>
        <CardContent className="py-6">
          {/* Business Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="h-12 mb-2" />}
              <h3 className="text-lg font-bold text-[var(--color-primary)]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                {settings?.business_name || 'Ideal Events Group'}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {settings?.abn && `ABN: ${settings.abn}`}<br />
                {settings?.address}<br />
                {[settings?.city, settings?.state, settings?.postcode].filter(Boolean).join(' ')}<br />
                {settings?.phone} &middot; {settings?.email}
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-[var(--color-primary)]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                INVOICE
              </h2>
              <p className="text-sm font-medium mt-1">{invoice.invoice_number}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Issue Date: {invoice.issue_date ? formatDateDocument(invoice.issue_date) : 'N/A'}<br />
                Due Date: {invoice.due_date ? formatDateDocument(invoice.due_date) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Bill To */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">Bill To</p>
              <p className="text-sm font-medium">{customer?.contact_name}</p>
              {customer?.business_name && <p className="text-sm text-[var(--color-text-muted)]">{customer.business_name}</p>}
              <p className="text-xs text-[var(--color-text-muted)]">{customer?.email}</p>
            </div>
            {(invoice.event_date || invoice.event_location) && (
              <div>
                <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">Event Details</p>
                {invoice.event_date && <p className="text-sm">{formatDateDocument(invoice.event_date)}</p>}
                {invoice.event_location && <p className="text-sm text-[var(--color-text-muted)]">{invoice.event_location}</p>}
              </div>
            )}
          </div>

          {/* Line Items */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-[var(--color-primary)]">
                <th className="py-2 text-left font-medium">Description</th>
                <th className="py-2 text-center font-medium w-16">Qty</th>
                <th className="py-2 text-right font-medium w-28">Unit Price</th>
                <th className="py-2 text-right font-medium w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, idx) => (
                <tr key={idx} className="border-b border-[var(--color-border)]">
                  <td className="py-3">
                    <p className="font-medium whitespace-pre-line">{item.description}</p>
                    {item.notes && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.notes}</p>}
                    {item.photos && item.photos.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {item.photos.map((url, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-12 h-12 rounded overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-light)]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-center">{item.quantity}</td>
                  <td className="py-3 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Discount</span>
                  <span className="text-red-500">-{formatCurrency(invoice.discount_amount)}</span>
                </div>
              )}
              {invoice.gst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">GST (10%)</span>
                  <span>{formatCurrency(invoice.gst_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-[var(--color-border)] pt-2">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between text-sm bg-[var(--color-accent-light)] p-2 rounded">
                <span>Deposit ({invoice.deposit_percentage}%)</span>
                <span className="font-medium">{formatCurrency(invoice.deposit_amount)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Amount Paid</span>
                <span>{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg bg-[var(--color-primary)] text-white p-3 rounded-md">
                <span>Balance Due</span>
                <span>{formatCurrency(invoice.balance_due)}</span>
              </div>
            </div>
          </div>

          {/* Bank Details */}
          {settings && (settings.bsb || settings.account_number) && (
            <div className="mt-8 p-4 bg-[var(--color-bg-light)] rounded-md">
              <h4 className="text-sm font-bold mb-2">Payment Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {settings.bank_name && <><span className="text-[var(--color-text-muted)]">Bank:</span><span>{settings.bank_name}</span></>}
                {settings.account_name && <><span className="text-[var(--color-text-muted)]">Account Name:</span><span>{settings.account_name}</span></>}
                {settings.bsb && <><span className="text-[var(--color-text-muted)]">BSB:</span><span>{settings.bsb}</span></>}
                {settings.account_number && <><span className="text-[var(--color-text-muted)]">Account Number:</span><span>{settings.account_number}</span></>}
              </div>
              {settings.bank_reference_note && (
                <p className="text-xs text-[var(--color-text-muted)] mt-2">{settings.bank_reference_note}</p>
              )}
            </div>
          )}

          {/* Payment History */}
          {invoice.payment_history && invoice.payment_history.length > 0 && (
            <div className="mt-8">
              <h4 className="text-sm font-bold mb-2">Payment History</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="py-2 text-left font-medium">Date</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                    <th className="py-2 text-left font-medium">Method</th>
                    <th className="py-2 text-left font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payment_history.map((p, idx) => (
                    <tr key={idx} className="border-b border-[var(--color-border)]">
                      <td className="py-2">{formatDateAU(p.date)}</td>
                      <td className="py-2 text-right text-green-600 font-medium">{formatCurrency(p.amount)}</td>
                      <td className="py-2 capitalize">{p.payment_method.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-[var(--color-text-muted)]">{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoice.notes && (
            <div className="mt-6 text-sm text-[var(--color-text-muted)]">
              <strong>Notes:</strong> {invoice.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Profit & Expenses */}
      {(() => {
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const revenue = invoice.amount_paid;
        const profit = revenue - totalExpenses;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        return (
          <Card>
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-text)]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                Event Profitability
              </h3>
              <Link href={`/expenses`}>
                <Button variant="outline" size="sm">
                  <Plus className="w-3.5 h-3.5" /> Add Expense
                </Button>
              </Link>
            </div>
            <CardContent className="py-4">
              {/* Profit Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 rounded-lg bg-[var(--color-bg-light)]">
                  <p className="text-xs text-[var(--color-text-muted)]">Invoice Total</p>
                  <p className="text-lg font-bold">{formatCurrency(invoice.total)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-xs text-[var(--color-text-muted)]">Revenue (Paid)</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(revenue)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-xs text-[var(--color-text-muted)]">Total Expenses</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${profit >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <p className="text-xs text-[var(--color-text-muted)]">Profit</p>
                  <div className="flex items-center justify-center gap-1">
                    {profit >= 0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                    <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(profit))}
                    </p>
                  </div>
                  {revenue > 0 && (
                    <p className={`text-xs ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {margin.toFixed(1)}% margin
                    </p>
                  )}
                </div>
              </div>

              {/* Expense List */}
              {expenses.length === 0 ? (
                <div className="text-center py-6 text-sm text-[var(--color-text-muted)]">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No expenses linked to this event yet.</p>
                  <p className="text-xs mt-1">Go to Expenses and link them to this invoice.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="py-2 text-left font-medium text-[var(--color-text-muted)]">Date</th>
                      <th className="py-2 text-left font-medium text-[var(--color-text-muted)]">Description</th>
                      <th className="py-2 text-left font-medium text-[var(--color-text-muted)]">Category</th>
                      <th className="py-2 text-right font-medium text-[var(--color-text-muted)]">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-[var(--color-border)]">
                        <td className="py-2">{formatDateAU(e.date)}</td>
                        <td className="py-2 font-medium">{e.description}</td>
                        <td className="py-2 capitalize text-[var(--color-text-muted)]">{e.category}</td>
                        <td className="py-2 text-right font-medium text-red-600">{formatCurrency(e.amount)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="py-2 text-right font-bold">Total Expenses</td>
                      <td className="py-2 text-right font-bold text-red-600">{formatCurrency(totalExpenses)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex justify-end gap-2">
        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <Ban className="w-3.5 h-3.5" /> Cancel Invoice
          </Button>
        )}
        {invoice.amount_paid === 0 && (
          <Button variant="danger" size="sm" onClick={handleDelete} loading={saving}>
            <Trash2 className="w-3.5 h-3.5" /> Delete Invoice
          </Button>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Record Payment">
        <div className="space-y-4">
          <Input label="Date" type="date" value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} />
          <Input label="Amount (AUD)" type="number" step="0.01" value={payment.amount || ''} onChange={(e) => setPayment({ ...payment, amount: parseFloat(e.target.value) || 0 })} />
          <Select label="Payment Method" value={payment.payment_method} onChange={(e) => setPayment({ ...payment, payment_method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </Select>
          <Input label="Notes" value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>Cancel</Button>
          <Button onClick={handleRecordPayment} loading={saving}>
            <DollarSign className="w-4 h-4" /> Record Payment
          </Button>
        </div>
      </Modal>

      {/* Send Invoice Modal */}
      <Modal open={sendModalOpen} onClose={() => setSendModalOpen(false)} title="Send Invoice">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">Sending to: <strong>{customer?.email}</strong></p>
          <Input label="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setSendModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSendInvoice} loading={saving}>
            <Send className="w-4 h-4" /> Send Invoice
          </Button>
        </div>
      </Modal>
    </div>
  );
}
