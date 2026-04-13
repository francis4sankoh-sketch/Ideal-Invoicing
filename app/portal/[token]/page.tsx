'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { Customer, Quote, Invoice, QuoteMessage, BusinessSettings } from '@/types';
import { formatCurrency, formatDateDocument, formatDateAU } from '@/lib/utils/format';
import { Badge } from '@/components/ui/badge';
import { Check, X, MessageCircle, FileText, Receipt, Send } from 'lucide-react';

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quote');
  const invoiceId = searchParams.get('invoice');

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [messages, setMessages] = useState<QuoteMessage[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [messageText, setMessageText] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'quote' | 'invoice'>('home');
  const supabase = createClient();

  useEffect(() => { loadPortal(); }, [token]);

  const loadPortal = async () => {
    const { data: cust } = await supabase
      .from('customers')
      .select('*')
      .eq('portal_token', token)
      .single();

    if (!cust) { setLoading(false); return; }
    setCustomer(cust);

    const [quotesRes, invoicesRes, settingsRes] = await Promise.all([
      supabase.from('quotes').select('*').eq('customer_id', cust.id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('customer_id', cust.id).order('created_at', { ascending: false }),
      supabase.from('business_settings').select('*').limit(1).single(),
    ]);

    setQuotes(quotesRes.data || []);
    setInvoices(invoicesRes.data || []);
    setSettings(settingsRes.data);

    if (quoteId) {
      const q = quotesRes.data?.find((q) => q.id === quoteId);
      if (q) { setSelectedQuote(q); setView('quote'); recordView('quotes', quoteId); loadMessages(quoteId); }
    } else if (invoiceId) {
      const inv = invoicesRes.data?.find((i) => i.id === invoiceId);
      if (inv) { setSelectedInvoice(inv); setView('invoice'); recordView('invoices', invoiceId); }
    }

    setLoading(false);
  };

  const recordView = async (table: string, id: string) => {
    const now = new Date().toISOString();
    await supabase.from(table).update({ last_viewed: now }).eq('id', id);
  };

  const loadMessages = async (qId: string) => {
    const { data } = await supabase
      .from('quote_messages')
      .select('*')
      .eq('quote_id', qId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const handleAcceptQuote = async () => {
    if (!selectedQuote || !customer) return;

    await supabase.from('quotes').update({ status: 'accepted' }).eq('id', selectedQuote.id);
    setSelectedQuote({ ...selectedQuote, status: 'accepted' });

    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quote_accepted',
          customerName: customer.contact_name,
          quoteNumber: selectedQuote.quote_number,
          total: formatCurrency(selectedQuote.total),
          depositAmount: formatCurrency(selectedQuote.deposit_amount),
        }),
      });
    } catch {}
  };

  const handleRejectQuote = async () => {
    if (!selectedQuote || !customer) return;

    await supabase.from('quotes').update({ status: 'rejected' }).eq('id', selectedQuote.id);
    setSelectedQuote({ ...selectedQuote, status: 'rejected' });
    setShowRejectModal(false);

    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quote_rejected',
          customerName: customer.contact_name,
          quoteNumber: selectedQuote.quote_number,
          reason: rejectReason,
        }),
      });
    } catch {}
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedQuote || !customer) return;

    await supabase.from('quote_messages').insert({
      quote_id: selectedQuote.id,
      sender_type: 'customer',
      sender_name: customer.contact_name,
      message: messageText.trim(),
    });

    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_message',
          customerName: customer.contact_name,
          quoteNumber: selectedQuote.quote_number,
          messagePreview: messageText.trim().slice(0, 100),
        }),
      });
    } catch {}

    setMessageText('');
    loadMessages(selectedQuote.id);
  };

  const openQuote = (q: Quote) => {
    setSelectedQuote(q);
    setView('quote');
    recordView('quotes', q.id);
    loadMessages(q.id);
  };

  const openInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setView('invoice');
    recordView('invoices', inv.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdf0ef] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#800020]" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#fdf0ef] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#800020]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Invalid Link
          </h1>
          <p className="text-sm text-gray-500 mt-2">This portal link is not valid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf0ef]">
      {/* Portal Header */}
      <header className="bg-[#800020] text-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>Ideal</h1>
            <p className="text-[10px] tracking-[0.25em] uppercase text-white/70">Events Group</p>
          </div>
          {view !== 'home' && (
            <button onClick={() => setView('home')} className="text-sm text-white/80 hover:text-white">
              &larr; Back to overview
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {view === 'home' && (
          <>
            <h2 className="text-2xl font-bold text-[#800020] mb-6" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Welcome, {customer.contact_name}
            </h2>

            {/* Quotes */}
            {quotes.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-600 uppercase mb-3">Your Quotes</h3>
                <div className="space-y-3">
                  {quotes.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => openQuote(q)}
                      className="w-full bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow text-left flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-[#800020]" />
                        <div>
                          <p className="text-sm font-medium">{q.quote_number} — {q.title}</p>
                          <p className="text-xs text-gray-500">{q.event_date ? formatDateDocument(q.event_date) : 'No date set'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold">{formatCurrency(q.total)}</span>
                        <Badge status={q.status} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Invoices */}
            {invoices.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-600 uppercase mb-3">Your Invoices</h3>
                <div className="space-y-3">
                  {invoices.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => openInvoice(inv)}
                      className="w-full bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow text-left flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Receipt className="w-5 h-5 text-[#800020]" />
                        <div>
                          <p className="text-sm font-medium">{inv.invoice_number} — {inv.title}</p>
                          <p className="text-xs text-gray-500">Due: {inv.due_date ? formatDateDocument(inv.due_date) : 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold">{formatCurrency(inv.balance_due)}</p>
                          <p className="text-xs text-gray-500">Balance due</p>
                        </div>
                        <Badge status={inv.status} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {quotes.length === 0 && invoices.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-500">No quotes or invoices yet.</p>
              </div>
            )}
          </>
        )}

        {view === 'quote' && selectedQuote && (
          <div className="space-y-6">
            {/* Quote Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="h-10 mb-2" />}
                  <h3 className="text-lg font-bold text-[#800020]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                    {settings?.business_name || 'Ideal Events Group'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {settings?.abn && `ABN: ${settings.abn}`}<br />
                    {settings?.email} &middot; {settings?.phone}
                  </p>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-bold text-[#800020]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>QUOTE</h2>
                  <p className="text-sm font-medium">{selectedQuote.quote_number}</p>
                  <Badge status={selectedQuote.status} />
                  {selectedQuote.valid_until && (
                    <p className="text-xs text-gray-500 mt-1">Valid until: {formatDateDocument(selectedQuote.valid_until)}</p>
                  )}
                </div>
              </div>

              {/* Event Details */}
              {(selectedQuote.event_date || selectedQuote.event_location) && (
                <div className="mb-4 p-3 bg-[#fdf0ef] rounded-md text-sm">
                  {selectedQuote.event_date && <p><strong>Event Date:</strong> {formatDateDocument(selectedQuote.event_date)}</p>}
                  {selectedQuote.event_location && <p><strong>Location:</strong> {selectedQuote.event_location}</p>}
                </div>
              )}

              {/* Line Items */}
              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="border-b-2 border-[#800020]">
                    <th className="py-2 text-left font-medium">Description</th>
                    <th className="py-2 text-center font-medium w-16">Qty</th>
                    <th className="py-2 text-right font-medium w-28">Price</th>
                    <th className="py-2 text-right font-medium w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedQuote.line_items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-3">
                        <p className="font-medium whitespace-pre-line">{item.description}</p>
                        {item.notes && <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>}
                        {item.photos && item.photos.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {item.photos.map((url, i) => (
                              <img key={i} src={url} alt="" className="w-16 h-16 rounded object-cover" />
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
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatCurrency(selectedQuote.subtotal)}</span>
                  </div>
                  {selectedQuote.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-red-500">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedQuote.discount_amount)}</span>
                    </div>
                  )}
                  {selectedQuote.gst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">GST (10%)</span>
                      <span>{formatCurrency(selectedQuote.gst_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(selectedQuote.total)}</span>
                  </div>
                  <div className="bg-[#800020] text-white p-3 rounded-md flex justify-between font-bold">
                    <span>Deposit Required ({selectedQuote.deposit_percentage}%)</span>
                    <span>{formatCurrency(selectedQuote.deposit_amount)}</span>
                  </div>
                </div>
              </div>

              {selectedQuote.notes && (
                <div className="mt-6 text-sm text-gray-600">
                  <strong>Notes:</strong> {selectedQuote.notes}
                </div>
              )}
              {selectedQuote.terms && (
                <div className="mt-4 text-xs text-gray-400">
                  <strong>Terms & Conditions:</strong><br />
                  {selectedQuote.terms}
                </div>
              )}
            </div>

            {/* Accept/Reject Buttons */}
            {selectedQuote.status === 'sent' && (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleAcceptQuote}
                  className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Check className="w-5 h-5" /> Accept Quote
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="flex items-center gap-2 px-8 py-3 border-2 border-red-500 text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors"
                >
                  <X className="w-5 h-5" /> Reject Quote
                </button>
              </div>
            )}

            {selectedQuote.status === 'accepted' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-700">You have accepted this quote. We will be in touch shortly!</p>
              </div>
            )}

            {/* Messages */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Messages
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-400">No messages yet. Send us a message below.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-lg text-sm max-w-[80%] ${
                        m.sender_type === 'customer'
                          ? 'ml-auto bg-[#800020] text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="text-xs opacity-70 mb-1">{m.sender_name || m.sender_type}</p>
                      <p>{m.message}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#800020]"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button
                  onClick={handleSendMessage}
                  className="px-4 py-2 bg-[#800020] text-white rounded-md text-sm hover:bg-[#4a0012] transition-colors flex items-center gap-1"
                >
                  <Send className="w-4 h-4" /> Send
                </button>
              </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl p-6 max-w-md w-full">
                  <h3 className="text-lg font-bold mb-3" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>Reject Quote</h3>
                  <p className="text-sm text-gray-500 mb-4">Would you like to share a reason? (optional)</p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#800020] mb-4"
                  />
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 border border-gray-200 rounded-md text-sm">Cancel</button>
                    <button onClick={handleRejectQuote} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">Confirm Rejection</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'invoice' && selectedInvoice && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="h-10 mb-2" />}
                <h3 className="text-lg font-bold text-[#800020]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  {settings?.business_name || 'Ideal Events Group'}
                </h3>
                <p className="text-xs text-gray-500">{settings?.abn && `ABN: ${settings.abn}`}</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-[#800020]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>INVOICE</h2>
                <p className="text-sm font-medium">{selectedInvoice.invoice_number}</p>
                <Badge status={selectedInvoice.status} />
                <p className="text-xs text-gray-500 mt-1">
                  Issued: {selectedInvoice.issue_date ? formatDateDocument(selectedInvoice.issue_date) : 'N/A'}<br />
                  Due: {selectedInvoice.due_date ? formatDateDocument(selectedInvoice.due_date) : 'N/A'}
                </p>
              </div>
            </div>

            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b-2 border-[#800020]">
                  <th className="py-2 text-left font-medium">Description</th>
                  <th className="py-2 text-center font-medium w-16">Qty</th>
                  <th className="py-2 text-right font-medium w-28">Price</th>
                  <th className="py-2 text-right font-medium w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.line_items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-3 font-medium whitespace-pre-line">{item.description}</td>
                    <td className="py-3 text-center">{item.quantity}</td>
                    <td className="py-3 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span><span>{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Discount</span><span>-{formatCurrency(selectedInvoice.discount_amount)}</span>
                  </div>
                )}
                {selectedInvoice.gst_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">GST (10%)</span><span>{formatCurrency(selectedInvoice.gst_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total</span><span>{formatCurrency(selectedInvoice.total)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Amount Paid</span><span>{formatCurrency(selectedInvoice.amount_paid)}</span>
                </div>
                <div className="bg-[#800020] text-white p-3 rounded-md flex justify-between font-bold text-lg">
                  <span>Balance Due</span><span>{formatCurrency(selectedInvoice.balance_due)}</span>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            {settings && (settings.bsb || settings.account_number) && (
              <div className="mt-8 p-4 bg-[#fdf0ef] rounded-md">
                <h4 className="text-sm font-bold mb-2">Payment Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {settings.bank_name && <><span className="text-gray-500">Bank:</span><span>{settings.bank_name}</span></>}
                  {settings.account_name && <><span className="text-gray-500">Account Name:</span><span>{settings.account_name}</span></>}
                  {settings.bsb && <><span className="text-gray-500">BSB:</span><span>{settings.bsb}</span></>}
                  {settings.account_number && <><span className="text-gray-500">Account Number:</span><span>{settings.account_number}</span></>}
                </div>
                {settings.bank_reference_note && (
                  <p className="text-xs text-gray-500 mt-2">{settings.bank_reference_note}</p>
                )}
              </div>
            )}

            {/* Payment History */}
            {selectedInvoice.payment_history && selectedInvoice.payment_history.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-bold mb-2">Payment History</h4>
                <div className="space-y-2">
                  {selectedInvoice.payment_history.map((p, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-green-50 rounded">
                      <span>{formatDateDocument(p.date)}</span>
                      <span className="font-medium text-green-600">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-400">
        <p>Ideal Events Group &middot; Melbourne, Victoria &middot; idealeventsgroup.com.au</p>
      </footer>
    </div>
  );
}
