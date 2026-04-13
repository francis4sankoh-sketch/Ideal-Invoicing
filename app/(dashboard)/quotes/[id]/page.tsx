'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Quote, Customer, LineItem, BusinessSettings, Product, QuoteMessage } from '@/types';
import { formatCurrency, formatDateAU, generateId } from '@/lib/utils/format';
import {
  ArrowLeft, Plus, Trash2, Save, Send, FileDown, Copy, ArrowRightLeft,
  MessageCircle, ChevronDown, ChevronUp, Upload, Package
} from 'lucide-react';
import Link from 'next/link';
import { PDFDownloadButton } from '@/components/pdf-download-button';

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();
  const supabase = createClient();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [messages, setMessages] = useState<QuoteMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    const [settingsRes, customersRes, productsRes] = await Promise.all([
      supabase.from('business_settings').select('*').limit(1).single(),
      supabase.from('customers').select('*').order('contact_name'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ]);

    setSettings(settingsRes.data);
    setCustomers(customersRes.data || []);
    setProducts(productsRes.data || []);

    if (isNew) {
      const s = settingsRes.data;
      const quoteNum = s ? `${s.quote_prefix}-${s.next_quote_number}` : 'Q-1001';
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + (s?.default_quote_validity || 30));

      setQuote({
        id: '',
        quote_number: quoteNum,
        customer_id: '',
        title: '',
        event_date: null,
        event_location: null,
        line_items: [],
        photos: [],
        subtotal: 0,
        discount_type: null,
        discount_value: 0,
        discount_amount: 0,
        include_gst: true,
        gst_amount: 0,
        total: 0,
        deposit_percentage: 20,
        deposit_amount: 0,
        status: 'draft',
        valid_until: validUntil.toISOString().split('T')[0],
        notes: null,
        terms: s?.default_terms || null,
        converted_to_invoice: false,
        invoice_id: null,
        view_history: [],
        last_viewed: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else {
      const { data } = await supabase.from('quotes').select('*').eq('id', id).single();
      if (data) setQuote(data);

      const { data: msgs } = await supabase
        .from('quote_messages')
        .select('*')
        .eq('quote_id', id)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);

      // Mark messages as read
      await supabase
        .from('quote_messages')
        .update({ read: true })
        .eq('quote_id', id)
        .eq('sender_type', 'customer')
        .eq('read', false);
    }

    setLoading(false);
  };

  const recalculate = (items: LineItem[], discountType: string | null, discountValue: number, includeGst: boolean, depositPct: number) => {
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    let discountAmount = 0;
    if (discountType === 'percentage') discountAmount = subtotal * (discountValue / 100);
    else if (discountType === 'fixed') discountAmount = discountValue;
    const afterDiscount = subtotal - discountAmount;
    const gstAmount = includeGst ? afterDiscount * 0.1 : 0;
    const total = afterDiscount + gstAmount;
    const depositAmount = total * (depositPct / 100);
    return { subtotal, discount_amount: discountAmount, gst_amount: gstAmount, total, deposit_amount: depositAmount };
  };

  const updateQuote = (updates: Partial<Quote>) => {
    if (!quote) return;
    const updated = { ...quote, ...updates };
    const calcs = recalculate(
      updated.line_items,
      updated.discount_type,
      updated.discount_value,
      updated.include_gst,
      updated.deposit_percentage
    );
    setQuote({ ...updated, ...calcs });
  };

  const addLineItem = (product?: Product) => {
    if (!quote) return;
    const item: LineItem = {
      id: generateId(),
      description: product?.name || '',
      quantity: 1,
      unit_price: product?.default_price || 0,
      total: product?.default_price || 0,
      notes: product?.description || '',
      photos: product?.photos || [],
    };
    updateQuote({ line_items: [...quote.line_items, item] });
  };

  const updateLineItem = (itemId: string, field: keyof LineItem, value: string | number | string[]) => {
    if (!quote) return;
    const items = quote.line_items.map((item) => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        updated.total = updated.quantity * updated.unit_price;
      }
      return updated;
    });
    updateQuote({ line_items: items });
  };

  const removeLineItem = (itemId: string) => {
    if (!quote) return;
    updateQuote({ line_items: quote.line_items.filter((i) => i.id !== itemId) });
  };

  const handleSave = async (status?: string) => {
    if (!quote || !quote.title || !quote.customer_id) return;
    setSaving(true);

    const payload = {
      quote_number: quote.quote_number,
      customer_id: quote.customer_id,
      title: quote.title,
      event_date: quote.event_date || null,
      event_location: quote.event_location || null,
      line_items: quote.line_items,
      subtotal: quote.subtotal,
      discount_type: quote.discount_type,
      discount_value: quote.discount_value,
      discount_amount: quote.discount_amount,
      include_gst: quote.include_gst,
      gst_amount: quote.gst_amount,
      total: quote.total,
      deposit_percentage: quote.deposit_percentage,
      deposit_amount: quote.deposit_amount,
      status: status || quote.status,
      valid_until: quote.valid_until,
      notes: quote.notes,
      terms: quote.terms,
    };

    if (isNew) {
      const { data, error } = await supabase.from('quotes').insert(payload).select().single();
      if (data) {
        // Increment quote number
        if (settings) {
          await supabase
            .from('business_settings')
            .update({ next_quote_number: settings.next_quote_number + 1 })
            .eq('id', settings.id);
        }
        router.push(`/quotes/${data.id}`);
      }
    } else {
      await supabase.from('quotes').update(payload).eq('id', quote.id);
      if (status) setQuote({ ...quote, status: status as Quote['status'] });
    }

    setSaving(false);
  };

  const handleSend = async () => {
    if (!quote) return;
    setSaving(true);

    const customer = customers.find((c) => c.id === quote.customer_id);
    if (!customer) return;

    const portalUrl = `${window.location.origin}/portal/${customer.portal_token}?quote=${quote.id}`;

    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quote_sent',
          customerEmail: customer.email,
          customerName: customer.contact_name,
          quoteNumber: quote.quote_number,
          total: formatCurrency(quote.total),
          depositAmount: formatCurrency(quote.deposit_amount),
          portalUrl,
          subject: emailSubject,
          body: emailBody,
        }),
      });

      await supabase.from('quotes').update({ status: 'sent' }).eq('id', quote.id);
      setQuote({ ...quote, status: 'sent' });
      setSendModalOpen(false);
    } catch (err) {
      console.error('Failed to send:', err);
    }
    setSaving(false);
  };

  const handleConvertToInvoice = async () => {
    if (!quote || !settings) return;
    setSaving(true);

    const invoiceNumber = `${settings.invoice_prefix}-${settings.next_invoice_number}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + settings.default_payment_terms);

    const { data: invoice } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        quote_id: quote.id,
        customer_id: quote.customer_id,
        title: quote.title,
        event_date: quote.event_date,
        event_location: quote.event_location,
        line_items: quote.line_items,
        subtotal: quote.subtotal,
        discount_amount: quote.discount_amount,
        gst_amount: quote.gst_amount,
        total: quote.total,
        deposit_percentage: quote.deposit_percentage,
        deposit_amount: quote.deposit_amount,
        balance_due: quote.total,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        notes: quote.notes,
      })
      .select()
      .single();

    if (invoice) {
      await supabase
        .from('quotes')
        .update({ converted_to_invoice: true, invoice_id: invoice.id })
        .eq('id', quote.id);

      await supabase
        .from('business_settings')
        .update({ next_invoice_number: settings.next_invoice_number + 1 })
        .eq('id', settings.id);

      router.push(`/invoices/${invoice.id}`);
    }
    setSaving(false);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !quote) return;

    await supabase.from('quote_messages').insert({
      quote_id: quote.id,
      sender_type: 'business',
      sender_name: 'Ideal Events Group',
      message: messageText.trim(),
    });

    setMessageText('');
    const { data: msgs } = await supabase
      .from('quote_messages')
      .select('*')
      .eq('quote_id', quote.id)
      .order('created_at', { ascending: true });
    setMessages(msgs || []);
  };

  const copyPortalLink = () => {
    if (!quote) return;
    const customer = customers.find((c) => c.id === quote.customer_id);
    if (!customer) return;
    const url = `${window.location.origin}/portal/${customer.portal_token}?quote=${quote.id}`;
    navigator.clipboard.writeText(url);
  };

  const toggleExpand = (itemId: string) => {
    const next = new Set(expandedItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setExpandedItems(next);
  };

  if (loading || !quote) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  const selectedCustomer = customers.find((c) => c.id === quote.customer_id);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <Link href="/quotes" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft className="w-4 h-4" /> Back to Quotes
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            {isNew ? 'New Quote' : quote.quote_number}
          </h2>
          {!isNew && <Badge status={quote.status} />}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isNew && (
            <>
              <Button variant="outline" size="sm" onClick={copyPortalLink}>
                <Copy className="w-3.5 h-3.5" /> Portal Link
              </Button>
              {settings && (
                <PDFDownloadButton type="quote" data={quote} customer={selectedCustomer} settings={settings} />
              )}
              {quote.status === 'accepted' && !quote.converted_to_invoice && (
                <Button size="sm" onClick={handleConvertToInvoice} loading={saving}>
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Convert to Invoice
                </Button>
              )}
              {(quote.status === 'draft' || quote.status === 'sent') && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEmailSubject(`Your quote from Ideal Events Group — ${quote.quote_number}`);
                    setEmailBody('');
                    setSendModalOpen(true);
                  }}
                >
                  <Send className="w-3.5 h-3.5" /> Send to Customer
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quote Form */}
      <Card>
        <CardContent className="space-y-6 py-6">
          {/* Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Quote Number" value={quote.quote_number} disabled />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[var(--color-text)]">Customer *</label>
              <select
                value={quote.customer_id}
                onChange={(e) => updateQuote({ customer_id: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contact_name} {c.business_name ? `(${c.business_name})` : ''} — {c.email}
                  </option>
                ))}
              </select>
            </div>
            <Input label="Title *" value={quote.title} onChange={(e) => updateQuote({ title: e.target.value })} placeholder="e.g. Wedding Styling Package" />
            <Input label="Event Date" type="date" value={quote.event_date || ''} onChange={(e) => updateQuote({ event_date: e.target.value || null })} />
            <Input label="Event Location" value={quote.event_location || ''} onChange={(e) => updateQuote({ event_location: e.target.value || null })} />
            <Input label="Valid Until" type="date" value={quote.valid_until || ''} onChange={(e) => updateQuote({ valid_until: e.target.value || null })} />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)]">Line Items</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setProductPickerOpen(true)}>
                  <Plus className="w-3 h-3" /> From Products
                </Button>
                <Button variant="outline" size="sm" onClick={() => addLineItem()}>
                  <Plus className="w-3 h-3" /> Manual Item
                </Button>
              </div>
            </div>

            {quote.line_items.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-lg">
                No items yet. Add items from products or manually.
              </div>
            ) : (
              <div className="space-y-3">
                {quote.line_items.map((item, idx) => (
                  <div key={item.id} className="border border-[var(--color-border)] rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-[var(--color-text-muted)] mt-2 w-6">{idx + 1}.</span>
                      <div className="flex-1 grid grid-cols-12 gap-3">
                        <div className="col-span-12 md:col-span-5">
                          <textarea
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            placeholder="Description"
                            rows={item.description.includes('\n') ? Math.min(item.description.split('\n').length + 1, 10) : 1}
                            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-y"
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            placeholder="Qty"
                            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            placeholder="Unit Price"
                            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        </div>
                        <div className="col-span-3 md:col-span-2 flex items-center">
                          <span className="text-sm font-medium">{formatCurrency(item.total)}</span>
                        </div>
                        <div className="col-span-1 flex items-center gap-1">
                          <button onClick={() => toggleExpand(item.id)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                            {expandedItems.has(item.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <button onClick={() => removeLineItem(item.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {expandedItems.has(item.id) && (
                      <div className="ml-9 mt-3 space-y-2">
                        <textarea
                          value={item.notes}
                          onChange={(e) => updateLineItem(item.id, 'notes', e.target.value)}
                          placeholder="Notes for this item..."
                          rows={2}
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        />
                        <div className="flex flex-wrap gap-2">
                          {item.photos?.map((url, i) => (
                            <div key={i} className="w-16 h-16 rounded overflow-hidden relative group">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                              <button
                                onClick={() => {
                                  const newPhotos = item.photos.filter((_, idx) => idx !== i);
                                  updateLineItem(item.id, 'photos', newPhotos);
                                }}
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                              >
                                <Trash2 className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Subtotal</span>
                <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
              </div>

              {/* Discount */}
              <div className="flex items-center gap-2">
                <select
                  value={quote.discount_type || ''}
                  onChange={(e) => updateQuote({ discount_type: (e.target.value || null) as Quote['discount_type'] })}
                  className="px-2 py-1.5 border border-[var(--color-border)] rounded text-xs bg-white dark:bg-[#1a1a1a]"
                >
                  <option value="">No discount</option>
                  <option value="percentage">% Discount</option>
                  <option value="fixed">$ Discount</option>
                </select>
                {quote.discount_type && (
                  <input
                    type="number"
                    step="0.01"
                    value={quote.discount_value}
                    onChange={(e) => updateQuote({ discount_value: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1.5 border border-[var(--color-border)] rounded text-xs bg-white dark:bg-[#1a1a1a]"
                  />
                )}
                {quote.discount_amount > 0 && (
                  <span className="text-sm text-red-500 ml-auto">-{formatCurrency(quote.discount_amount)}</span>
                )}
              </div>

              {/* GST */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <input
                    type="checkbox"
                    checked={quote.include_gst}
                    onChange={(e) => updateQuote({ include_gst: e.target.checked })}
                  />
                  GST (10%)
                </label>
                {quote.include_gst && <span className="text-sm">{formatCurrency(quote.gst_amount)}</span>}
              </div>

              <div className="border-t border-[var(--color-border)] pt-2 flex justify-between">
                <span className="font-bold text-[var(--color-text)]">Total</span>
                <span className="font-bold text-lg text-[var(--color-primary)]">{formatCurrency(quote.total)}</span>
              </div>

              <div className="flex items-center justify-between text-sm bg-[var(--color-accent-light)] p-3 rounded-md">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-muted)]">Deposit</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={quote.deposit_percentage}
                    onChange={(e) => updateQuote({ deposit_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-14 px-1 py-0.5 border border-[var(--color-border)] rounded text-xs text-center bg-white dark:bg-[#1a1a1a]"
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">%</span>
                </div>
                <span className="font-bold text-[var(--color-primary)]">{formatCurrency(quote.deposit_amount)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textarea label="Notes to Customer" rows={4} value={quote.notes || ''} onChange={(e) => updateQuote({ notes: e.target.value || null })} />
            <Textarea label="Terms & Conditions" rows={4} value={quote.terms || ''} onChange={(e) => updateQuote({ terms: e.target.value || null })} />
          </div>
        </CardContent>
      </Card>

      {/* Messages (non-new quotes) */}
      {!isNew && (
        <Card>
          <CardHeader>
            <h3 className="font-bold flex items-center gap-2" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              <MessageCircle className="w-4 h-4" /> Messages
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
              {messages.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No messages yet</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-lg text-sm max-w-[80%] ${
                      m.sender_type === 'business'
                        ? 'ml-auto bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg-light)] text-[var(--color-text)]'
                    }`}
                  >
                    <p className="text-xs opacity-70 mb-1">{m.sender_name || m.sender_type}</p>
                    <p>{m.message}</p>
                    <p className="text-xs opacity-50 mt-1">{formatDateAU(m.created_at)}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <Button size="sm" onClick={handleSendMessage}>Send</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-0 lg:left-60 right-0 bg-white dark:bg-[#1a1a1a] border-t border-[var(--color-border)] px-6 py-3 flex justify-end gap-3 z-30">
        <Button variant="outline" onClick={() => handleSave()} loading={saving}>
          <Save className="w-4 h-4" /> Save Draft
        </Button>
      </div>

      {/* Send Email Modal */}
      <Modal open={sendModalOpen} onClose={() => setSendModalOpen(false)} title="Send Quote" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Sending to: <strong>{selectedCustomer?.email}</strong>
          </p>
          <Input label="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
          <Textarea label="Custom message (optional)" rows={4} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Leave blank to use default template" />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setSendModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSend} loading={saving}>
            <Send className="w-4 h-4" /> Send Quote
          </Button>
        </div>
      </Modal>

      {/* Product Picker Modal */}
      <Modal open={productPickerOpen} onClose={() => setProductPickerOpen(false)} title="Add from Products" size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => { addLineItem(p); setProductPickerOpen(false); }}
              className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-light)] transition-colors text-left"
            >
              <div className="w-12 h-12 bg-[var(--color-bg-light)] rounded flex items-center justify-center shrink-0">
                {p.photos?.[0] ? (
                  <img src={p.photos[0]} alt="" className="w-full h-full object-cover rounded" />
                ) : (
                  <Package className="w-5 h-5 text-[var(--color-text-muted)]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-sm text-[var(--color-primary)] font-bold">{formatCurrency(p.default_price)}</p>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
